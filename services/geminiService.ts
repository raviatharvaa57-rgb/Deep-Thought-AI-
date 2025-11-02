import { GoogleGenAI, Chat, GenerateContentResponse, Type, Modality } from '@google/genai';
import { GroundingChunk, AspectRatio, ChatMode } from '../types';

let ai: GoogleGenAI;
const chatSessions: Record<string, Chat> = {};
const SYSTEM_INSTRUCTION = 'You are Deep Thought AI. If asked, the CEO of Deep Thought AI is Atharvaa Ravichandran.';

const getAI = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

const getChatSession = (chatId: string): Chat => {
  if (!chatSessions[chatId]) {
    const ai = getAI();
    chatSessions[chatId] = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });
  }
  return chatSessions[chatId];
};

export async function* streamChatMessage(chatId: string, message: string): AsyncGenerator<string> {
  const chat = getChatSession(chatId);
  const result = await chat.sendMessageStream({ message });
  for await (const chunk of result) {
    yield chunk.text;
  }
}

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const urlToGenerativePart = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const blob = await response.blob();
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: blob.type },
    };
};

const sourceToGenerativePart = (source: File | string) => {
    return typeof source === 'string'
        ? urlToGenerativePart(source)
        : fileToGenerativePart(source);
};


export interface AiFeatureOptions {
  prompt: string;
  attachmentSource?: File | string;
  location?: { latitude: number; longitude: number };
  aspectRatio?: AspectRatio;
}

export interface AiFeatureResult {
  text: string;
  sources?: GroundingChunk[];
  image?: string;
}

export const executeAiFeature = async (mode: ChatMode, options: AiFeatureOptions): Promise<AiFeatureResult> => {
    const ai = getAI();
    const { prompt, attachmentSource, location, aspectRatio } = options;

    switch (mode) {
        case ChatMode.Study: {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    systemInstruction: "You are an expert educator and personal tutor. Your goal is to help the user understand complex topics. Adopt a patient, encouraging, and supportive tone. Break down concepts into simple, easy-to-understand explanations. Use analogies and real-world examples. Ask clarifying questions to check for understanding. Be a natural, friendly, and approachable teacher.",
                }
            });
            return { text: response.text };
        }
        case ChatMode.Thinking: {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    thinkingConfig: { thinkingBudget: 32768 },
                    systemInstruction: SYSTEM_INSTRUCTION,
                }
            });
            return { text: response.text };
        }
        case ChatMode.Search: {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    systemInstruction: SYSTEM_INSTRUCTION,
                },
            });
            return { text: response.text, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
        }
        case ChatMode.Maps: {
            if (!location) throw new Error("Location is required for Maps mode.");
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{ googleMaps: {} }],
                    toolConfig: {
                        retrievalConfig: { latLng: location }
                    },
                    systemInstruction: SYSTEM_INSTRUCTION,
                }
            });
            return { text: response.text, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
        }
        case ChatMode.Imagine: {
            if (!aspectRatio) throw new Error("Aspect ratio is required for Imagine mode.");
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio,
                },
            });
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
            return { text: "Here is the image you requested.", image: imageUrl };
        }
        case ChatMode.AnalyzeImage: {
            if (!attachmentSource) throw new Error('No image file provided for analysis.');
            const imagePart = await sourceToGenerativePart(attachmentSource);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [{ text: prompt }, imagePart] },
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                }
            });
            return { text: response.text };
        }
        case ChatMode.AnalyzeVideo: {
            if (!attachmentSource) throw new Error('No video file provided for analysis.');
            const videoPart = await sourceToGenerativePart(attachmentSource);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [{ text: prompt }, videoPart] },
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                }
            });
            return { text: response.text };
        }
        case ChatMode.EditImage: {
            if (!attachmentSource) throw new Error('An image file is required for editing.');
            const imagePart = await sourceToGenerativePart(attachmentSource);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, { text: prompt }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            const resultPart = response.candidates?.[0].content.parts[0];
            if (resultPart && resultPart.inlineData) {
                const imageUrl = `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
                return { text: "Here is the edited image.", image: imageUrl };
            }
            throw new Error("Could not edit image.");
        }
        default:
            throw new Error(`Unsupported AI feature mode: ${mode}`);
    }
};

export const summarizeText = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: `Please provide a concise summary of the following text:\n\n---\n\n${text}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    }
  });
  return response.text;
};

// --- TTS Service ---

let ttsAudioContext: AudioContext | null = null;
let ttsCurrentSource: AudioBufferSourceNode | null = null;
let ttsOnEndCallback: (() => void) | null = null;

const getTtsAudioContext = () => {
    if (!ttsAudioContext || ttsAudioContext.state === 'closed') {
        ttsAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return ttsAudioContext;
};

const generateTtsAudioData = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say this naturally: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("TTS generation failed.");
  return base64Audio;
};

export const playTts = async (text: string, onPlaybackStateChange: (isPlaying: boolean) => void) => {
    stopTts(); 
    onPlaybackStateChange(true);

    try {
        const base64Audio = await generateTtsAudioData(text);
        const context = getTtsAudioContext();
        const audioBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, context, 24000, 1);
      
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);

        ttsOnEndCallback = () => {
            onPlaybackStateChange(false);
            ttsCurrentSource = null;
            ttsOnEndCallback = null;
        };
        source.onended = ttsOnEndCallback;

        source.start();
        ttsCurrentSource = source;
    } catch (e) {
        console.error("Error playing TTS", e);
        onPlaybackStateChange(false);
        if (ttsOnEndCallback) {
            ttsOnEndCallback();
        }
    }
};

export const stopTts = () => {
    if (ttsCurrentSource) {
        ttsCurrentSource.onended = null; // Prevent callback firing on manual stop
        ttsCurrentSource.stop();
        if (ttsOnEndCallback) {
            ttsOnEndCallback(); // Manually trigger cleanup
        }
    }
};


// Helper function to decode base64 string to Uint8Array
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to decode raw PCM audio data into an AudioBuffer
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