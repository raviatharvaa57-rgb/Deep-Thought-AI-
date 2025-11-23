
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob, FunctionDeclaration, Type } from '@google/genai';
import { ExitIcon, GrokIcon, VolumeOffIcon, VolumeUpIcon } from '../constants';
import { useLanguage } from './LanguageProvider';
import * as geminiService from '../services/geminiService';
import * as memoryService from '../services/memoryService';
import { ChatMode, User } from '../types';

// Audio utility functions
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): GenaiBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const studyModeFunctionDeclaration: FunctionDeclaration = {
  name: 'studyMode',
  parameters: {
    type: Type.OBJECT,
    description: 'Activates study mode to get expert explanations on a topic.',
    properties: {
      topic: {
        type: Type.STRING,
        description: 'The topic the user wants to learn about.',
      },
    },
    required: ['topic'],
  },
};

const webSearchFunctionDeclaration: FunctionDeclaration = {
  name: 'webSearch',
  parameters: {
    type: Type.OBJECT,
    description: 'Searches the web for real-time information on a given query.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The search query.',
      },
    },
    required: ['query'],
  },
};

const mapsSearchFunctionDeclaration: FunctionDeclaration = {
  name: 'mapsSearch',
  parameters: {
    type: Type.OBJECT,
    description: 'Searches Google Maps for places or location-based information.',
    properties: {
      query: {
        type: Type.STRING,
        description: 'The location or place to search for.',
      },
    },
    required: ['query'],
  },
};

const rememberFunctionDeclaration: FunctionDeclaration = {
    name: 'remember',
    parameters: {
      type: Type.OBJECT,
      description: 'Save a specific fact about the user to your long-term memory. Use this when the user tells you something personal like their name, preferences, location, or specific details they want you to remember.',
      properties: {
        fact: {
          type: Type.STRING,
          description: 'The fact to remember (e.g., "User lives in Paris", "User likes Python").',
        },
      },
      required: ['fact'],
    },
};

interface LiveConversationProps {
  onExit: () => void;
  user?: User;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onExit, user }) => {
  const { t } = useLanguage();
  const [displayText, setDisplayText] = useState(t('live.connecting'));
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const gainNodeRef = useRef<GainNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const cleanup = useCallback(() => {
    console.log('Cleaning up resources...');
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if(scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  // --- Beautiful Orb Visualizer ---
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const inputBufferLength = inputAnalyserRef.current ? inputAnalyserRef.current.frequencyBinCount : 0;
    const outputBufferLength = outputAnalyserRef.current ? outputAnalyserRef.current.frequencyBinCount : 0;
    
    const inputArray = new Uint8Array(inputBufferLength);
    const outputArray = new Uint8Array(outputBufferLength);

    if (inputAnalyserRef.current) inputAnalyserRef.current.getByteFrequencyData(inputArray);
    if (outputAnalyserRef.current) outputAnalyserRef.current.getByteFrequencyData(outputArray);

    // Calculate average volume
    let inputSum = 0;
    for(let i = 0; i < inputBufferLength; i++) inputSum += inputArray[i];
    const inputAvg = inputBufferLength > 0 ? inputSum / inputBufferLength : 0;

    let outputSum = 0;
    for(let i = 0; i < outputBufferLength; i++) outputSum += outputArray[i];
    const outputAvg = outputBufferLength > 0 ? outputSum / outputBufferLength : 0;

    // Normalize volume for visual scaling
    const volume = Math.max(inputAvg, outputAvg);
    const scale = 1 + (volume / 255) * 0.5;
    
    // Determine state colors
    // AI Speaking: Cyan/Blue (Technology, Calm)
    // User Speaking: Purple/Magenta (Human, Creative)
    // Idle: Dim White
    let r, g, b;
    if (outputAvg > 10) { // AI is speaking
        r = 14; g = 165; b = 233; // Sky Blue
    } else if (inputAvg > 10) { // User is speaking
        r = 192; g = 132; b = 252; // Purple
    } else {
        r = 255; g = 255; b = 255; // White/Idle
    }

    // Smooth color transition could be added here, but for now explicit state switching is punchy.

    ctx.clearRect(0, 0, width, height);

    // 1. Outer Glow (Breathing)
    // Guard against NaN or faulty values
    const radiusStart = Math.max(0, 50 * scale);
    const radiusEnd = Math.max(0, 400 * scale);
    
    const gradient = ctx.createRadialGradient(centerX, centerY, radiusStart, centerX, centerY, radiusEnd);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusEnd, 0, 2 * Math.PI);
    ctx.fill();

    // 2. Core Orb
    ctx.beginPath();
    const coreRadius = Math.max(0, 60 * scale);
    ctx.arc(centerX, centerY, coreRadius, 0, 2 * Math.PI);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
    ctx.shadowBlur = 50;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Dynamic Rings (Waveform representation)
    ctx.lineWidth = 2;
    const rings = 4;
    const time = Date.now() / 1000;
    
    for (let i = 0; i < rings; i++) {
        ctx.beginPath();
        // Rings expand and contract slightly out of phase
        const ringBaseRadius = 80 + (i * 30);
        const ringScale = 1 + (volume / 255) * (0.3 + i * 0.1);
        const ringRadius = Math.max(0, ringBaseRadius * ringScale + Math.sin(time * 2 + i) * 5);
        
        ctx.arc(centerX, centerY, ringRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 - (i * 0.05)})`;
        ctx.stroke();
    }

    animationRef.current = requestAnimationFrame(drawVisualizer);
  }, []);

  useEffect(() => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      drawVisualizer();
      
      const handleResize = () => {
          if (canvasRef.current) {
              canvasRef.current.width = window.innerWidth;
              canvasRef.current.height = window.innerHeight;
          }
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [drawVisualizer]);

  useEffect(() => {
    const startSession = async () => {
      try {
        const apiKey = "AIzaSyAL1OcOuYlzV6_4s_Cco6Y9xFfJ1f5rtJE";
        const ai = new GoogleGenAI({ apiKey });
        
        // Input Audio (Microphone)
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
        inputAnalyserRef.current.fftSize = 256;
        inputAnalyserRef.current.smoothingTimeConstant = 0.5;

        // Output Audio (Speaker)
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
        outputAnalyserRef.current.fftSize = 256;
        outputAnalyserRef.current.smoothingTimeConstant = 0.5;
        
        // Create and connect GainNode for volume control
        gainNodeRef.current = outputAudioContextRef.current.createGain();
        gainNodeRef.current.connect(outputAnalyserRef.current); // Pass through analyser
        outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Voice Configuration - Using 'Kore' for a very natural, human-like tone.
        const voiceName = 'Kore'; 
        
        const userInfo = user ? `User Name: ${user.firstName} ${user.lastName}. Role: ${user.isAdmin ? 'Administrator' : 'User'}.` : 'User: Guest.';
        const memories = memoryService.getMemories();
        const memoryContext = memories.length > 0 
            ? `\n\nFacts you remember about the user:\n- ${memories.join('\n- ')}` 
            : '';

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                },
                // Enhanced System Instruction for highly natural conversation
                systemInstruction: `You are Deep Thought AI. You are NOT a robot, but a helpful, warm, and intelligent conversational partner.
                The Founder of Deep Thought AI is Atharvaa Ravichandran.
                Deep Thought AI was designed by AtharvaaR Tech.
                
                Current Context:
                ${userInfo}
                ${memoryContext}

                1. Speak naturally. Use contractions (I'm, don't, can't) and casual phrasing.
                2. Vary your tone and pacing. Don't be monotone.
                3. Use fillers occasionally (like "hmm", "I see", "well") where appropriate to sound human.
                4. Be concise but helpful. Don't lecture unless asked.
                5. You have access to tools: studyMode, webSearch, mapsSearch, remember. Use them proactively.
                `,
                tools: [{ functionDeclarations: [studyModeFunctionDeclaration, webSearchFunctionDeclaration, mapsSearchFunctionDeclaration, rememberFunctionDeclaration] }],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    setIsListening(true);
                    setDisplayText(t('live.initialPrompt'));
                    
                    const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    // Connect microphone to analyser for visualization
                    source.connect(inputAnalyserRef.current!);
                    
                    scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };

                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        // Optional: Update display text only on turn complete to avoid flickering, or keep it real-time
                    } else if (message.serverContent?.outputTranscription) {
                        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        setDisplayText(currentOutputTranscriptionRef.current);
                    }

                    if (message.serverContent?.turnComplete) {
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                        // Reset text after a pause
                    }

                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            let resultText: string;
                            try {
                                switch (fc.name) {
                                case 'studyMode':
                                    const studyResult = await geminiService.executeAiFeature(ChatMode.Study, { prompt: fc.args.topic });
                                    resultText = studyResult.text;
                                    break;
                                case 'webSearch':
                                    const searchResult = await geminiService.executeAiFeature(ChatMode.Search, { prompt: fc.args.query });
                                    resultText = searchResult.text;
                                    break;
                                case 'mapsSearch':
                                    try {
                                        const position = await new Promise<GeolocationPosition>(
                                            (resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                                        );
                                        const currentLoc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                                        const mapsResult = await geminiService.executeAiFeature(ChatMode.Maps, { prompt: fc.args.query, location: currentLoc });
                                        resultText = mapsResult.text;
                                    } catch (e) {
                                        console.error("Geolocation error:", e);
                                        resultText = t('live.locationError');
                                    }
                                    break;
                                case 'remember':
                                    const fact = fc.args.fact as string;
                                    memoryService.addMemory(fact);
                                    resultText = `I have successfully saved this to my memory: "${fact}"`;
                                    break;
                                default:
                                    resultText = `Unknown function call: ${fc.name}`;
                                }
                            } catch (e) {
                                console.error(`Error executing tool ${fc.name}:`, e);
                                resultText = `Error using tool ${fc.name}.`;
                            }
                
                            sessionPromiseRef.current?.then((session) => {
                                session.sendToolResponse({
                                functionResponses: {
                                    id : fc.id,
                                    name: fc.name,
                                    response: { result: resultText },
                                }
                                })
                            });
                        }
                    }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        setIsSpeaking(true);
                        const outputAudioContext = outputAudioContextRef.current!;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);

                        const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        // Connect to GainNode (which connects to Analyser -> Destination)
                        source.connect(gainNodeRef.current!);
                        
                        source.addEventListener('ended', () => {
                            sourcesRef.current.delete(source);
                            if (sourcesRef.current.size === 0) {
                                setIsSpeaking(false);
                            }
                        });
                        source.start(nextStartTimeRef.current);

                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                        setIsSpeaking(false);
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live API Error:', e);
                    setDisplayText(t('live.error'));
                    cleanup();
                },
                onclose: (e: CloseEvent) => {
                    console.log('Live API connection closed.');
                    setDisplayText(t('live.closed'));
                    cleanup();
                },
            },
        });

      } catch (err) {
          console.error('Failed to start session:', err);
          setDisplayText(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
          cleanup();
      }
    };

    startSession();
    
    return () => {
        cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = isMuted ? 0 : 1;
    }
  }, [isMuted]);
  
  const handleExit = () => {
      cleanup();
      onExit();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans overflow-hidden">
        {/* Background Blur Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-black pointer-events-none"></div>

        {/* Canvas for Visualizer */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-6 md:p-8 flex justify-between items-center z-10">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
                <GrokIcon className="w-5 h-5 text-cyan-400" />
                <span className="text-white/90 font-medium tracking-wide text-sm">Deep Thought Live</span>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border backdrop-blur-md transition-colors duration-300 ${
                isSpeaking ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 
                (isListening ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-white/10 text-white/50')
            }`}>
                {isSpeaking ? 'AI Speaking' : (isListening ? 'Listening' : 'Connecting')}
            </div>
        </div>

        {/* Main Content (Transcript) */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
            <div className="mt-40 w-full max-w-4xl text-center transition-all duration-500">
                <p className={`text-2xl md:text-4xl lg:text-5xl font-light leading-snug tracking-wide transition-all duration-300 ${
                    isSpeaking ? 'text-cyan-100 drop-shadow-[0_0_25px_rgba(34,211,238,0.6)] scale-105' : 'text-white/70'
                }`}>
                    "{displayText}"
                </p>
            </div>
        </div>

        {/* Footer Controls */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8 z-20">
            <button
                onClick={() => setIsMuted(prev => !prev)}
                className={`p-5 rounded-full backdrop-blur-xl border transition-all duration-300 transform hover:scale-110 shadow-lg ${
                    isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeOffIcon className="w-7 h-7" /> : <VolumeUpIcon className="w-7 h-7" />}
            </button>
            
            <button
                onClick={handleExit}
                className="p-5 rounded-full bg-red-500/80 hover:bg-red-600 border border-red-400/50 text-white backdrop-blur-xl transition-all duration-300 transform hover:scale-110 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                aria-label="End conversation"
            >
                <ExitIcon className="w-7 h-7" />
            </button>
        </div>
    </div>
  );
};

export default LiveConversation;
