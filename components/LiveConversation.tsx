import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from '@google/genai';
import { ExitIcon, MicIcon, PelicanIcon } from '../constants';
import { useLanguage } from './LanguageProvider';

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

type VoiceOption = 'male' | 'female';

interface LiveConversationProps {
  onExit: () => void;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onExit }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState(t('live.chooseVoice'));
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption | null>(null);
  
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

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
  }, []);

  useEffect(() => {
    if (!selectedVoice) {
      return;
    }

    const startSession = async () => {
      try {
        setStatus(t('live.connecting'));
        if (!process.env.API_KEY) {
            setStatus('API Key not found.');
            return;
        }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsListening(true);
        setStatus(t('live.connected'));
        
        const voiceName = selectedVoice === 'male' ? 'Puck' : 'Charon';

        sessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                },
                systemInstruction: 'You are Deep Thought AI. Use a natural, conversational tone. You must automatically detect the language the user is speaking and respond in that same language. If asked, your designer is AtharvaaR Tech and the CEO of Deep Thought AI is Atharvaa Ravichandran.',
            },
            callbacks: {
                onopen: () => {
                    const source = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob: GenaiBlob = {
                            data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };

                    source.connect(scriptProcessorRef.current);
                    scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle audio playback
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        const outputAudioContext = outputAudioContextRef.current!;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);

                        const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => sourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);

                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Live API Error:', e);
                    setStatus(t('live.error'));
                    cleanup();
                },
                onclose: (e: CloseEvent) => {
                    console.log('Live API connection closed.');
                    setStatus(t('live.closed'));
                    cleanup();
                },
            },
        });

      } catch (err) {
          console.error('Failed to start session:', err);
          setStatus(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`);
          cleanup();
      }
    };

    startSession();
    
    return () => {
        cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, t]);
  
  const handleExit = () => {
      cleanup();
      onExit();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex flex-col items-center justify-between z-50 text-white p-6">
      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-3">
          <PelicanIcon className="w-8 h-8"/>
          <h2 className="text-xl font-bold">{t('live.title')}</h2>
        </div>
        <button onClick={handleExit} className="p-2 rounded-full bg-white/20 hover:bg-white/30 z-20">
          <ExitIcon className="w-6 h-6" />
        </button>
      </div>
      
      <div className="text-center">
        {!selectedVoice ? (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-6">{t('live.chooseVoice')}</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setSelectedVoice('male')}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-bold transition-transform transform hover:scale-105"
              >
                {t('live.voice.male')}
              </button>
              <button
                onClick={() => setSelectedVoice('female')}
                className="px-8 py-4 bg-pink-600 hover:bg-pink-700 rounded-lg text-lg font-bold transition-transform transform hover:scale-105"
              >
                {t('live.voice.female')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`relative w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-blue-500/30' : 'bg-gray-500/30'}`}>
                <div className={`absolute inset-0 rounded-full ${isListening ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <MicIcon className="w-12 h-12 md:w-16 md:h-16 z-10" />
            </div>
            <p className="text-md md:text-lg mt-6 text-gray-300">{status}</p>
            <p className="text-xs text-gray-500 mt-4">Talking person designed by AtharvaaR tech</p>
          </>
        )}
      </div>

      <div className="w-full h-12"></div>
    </div>
  );
};

export default LiveConversation;