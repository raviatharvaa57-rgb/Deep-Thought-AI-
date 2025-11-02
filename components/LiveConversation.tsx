import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob, FunctionDeclaration, Type } from '@google/genai';
import { ExitIcon, GrokIcon, VolumeOffIcon, VolumeUpIcon } from '../constants';
import { useLanguage } from './LanguageProvider';
import * as geminiService from '../services/geminiService';
import { ChatMode } from '../types';

// Audio utility functions (decode/encode)
// Base64 decode
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Base64 encode
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Raw PCM to AudioBuffer
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

interface LiveConversationProps {
  onExit: () => void;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onExit }) => {
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
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    const startSession = async () => {
      try {
        if (!process.env.API_KEY) {
            setDisplayText('API Key not found.');
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        // Create and connect GainNode for volume control
        gainNodeRef.current = outputAudioContextRef.current.createGain();
        gainNodeRef.current.connect(outputAudioContextRef.current.destination);

        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const voiceName = 'Kore'; // Default to a female voice

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                },
                systemInstruction: 'You are Deep Thought AI, a friendly and helpful conversational partner. Your goal is to have a natural, human-like conversation. Speak in a relaxed and conversational tone, occasionally using filler words like "um" or "well", and vary your sentence structure to sound more natural. You must automatically detect the language the user is speaking and respond in that same language. If asked, your designer is AtharvaaR Tech and the CEO of Deep Thought AI is Atharvaa Ravichandran. You have access to tools for studying complex topics (studyMode), searching the web for real-time information (webSearch), and finding places on maps (mapsSearch). Proactively use these tools when the user\'s query suggests it would be helpful. After using a tool, summarize the result conversationally and naturally in your spoken response.',
                tools: [{ functionDeclarations: [studyModeFunctionDeclaration, webSearchFunctionDeclaration, mapsSearchFunctionDeclaration] }],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    setIsListening(true);
                    setDisplayText(t('live.initialPrompt'));
                    const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
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
                        setDisplayText(currentInputTranscriptionRef.current);
                    } else if (message.serverContent?.outputTranscription) {
                        currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        setDisplayText(currentOutputTranscriptionRef.current);
                    }

                    if (message.serverContent?.turnComplete) {
                        currentInputTranscriptionRef.current = '';
                        currentOutputTranscriptionRef.current = '';
                        // After a short delay, reset to the initial prompt if AI is not speaking
                        setTimeout(() => {
                           if (!isSpeaking) {
                               setDisplayText(t('live.initialPrompt'));
                           }
                        }, 1500);
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
                                default:
                                    resultText = `Unknown function call: ${fc.name}`;
                                }
                            } catch (e) {
                                console.error(`Error executing tool ${fc.name}:`, e);
                                resultText = `There was an error while trying to use the ${fc.name} tool.`;
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
                        source.connect(gainNodeRef.current!);
                        source.addEventListener('ended', () => {
                            sourcesRef.current.delete(source);
                            if (sourcesRef.current.size === 0) {
                                setIsSpeaking(false);
                                setDisplayText(t('live.initialPrompt'));
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
    <div className="fixed inset-0 bg-dark-bg z-50 flex flex-col items-center justify-center p-4 transition-all duration-300 font-sans">
        <div
            className={`absolute inset-0 transition-all duration-1000 ${
                isListening || isSpeaking
                    ? 'bg-gradient-radial from-dark-accent/20 via-dark-sidebar/10 to-dark-bg'
                    : 'bg-gradient-radial from-dark-sidebar/20 via-dark-sidebar/10 to-dark-bg'
            }`}
        ></div>

        <div className="absolute top-0 left-0 right-0 p-6 flex justify-center items-center text-dark-text/80">
            <div className="flex items-center gap-3">
                <GrokIcon className="w-7 h-7" />
                <h2 className="text-xl font-medium">{t('live.title')}</h2>
            </div>
        </div>

        <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
            <div
                className={`absolute w-full h-full rounded-full bg-dark-accent/10 transition-transform duration-700 ease-in-out ${
                    isSpeaking ? 'animate-pulse scale-125' : 'scale-100'
                }`}
                style={{ animationDuration: '1.5s' }}
            ></div>
            <div
                className={`absolute w-2/3 h-2/3 rounded-full bg-dark-accent/20 transition-transform duration-700 ease-in-out delay-100 ${
                    isSpeaking ? 'scale-110' : 'scale-100'
                }`}
            ></div>
            <div
                className={`w-1/2 h-2/2 rounded-full bg-gradient-to-br from-dark-accent to-blue-500 shadow-2xl flex items-center justify-center transition-transform duration-500 ${
                    isListening || isSpeaking ? 'scale-110' : 'scale-100'
                }`}
            >
                <GrokIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white/90" />
            </div>
        </div>

        <div className="h-24 mt-8 text-center text-xl sm:text-2xl text-dark-text transition-opacity duration-300 flex items-center justify-center">
            <p className="max-w-xl">{displayText}</p>
        </div>

        <div className="absolute bottom-12 flex items-center gap-4">
            <button
                onClick={() => setIsMuted(prev => !prev)}
                className="p-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm shadow-lg transition-transform transform hover:scale-110"
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeOffIcon className="w-8 h-8 text-white" /> : <VolumeUpIcon className="w-8 h-8 text-white" />}
            </button>
            <button
                onClick={handleExit}
                className="p-4 rounded-full bg-red-600/20 hover:bg-red-600/40 backdrop-blur-sm shadow-lg transition-transform transform hover:scale-110"
                aria-label="End conversation"
            >
                <ExitIcon className="w-8 h-8 text-white" />
            </button>
        </div>
    </div>
  );
};

export default LiveConversation;