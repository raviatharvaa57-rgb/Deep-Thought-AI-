import { GoogleGenAI, Chat, GenerateContentResponse, Type, Modality } from '@google/genai';
import { GroundingChunk, AspectRatio, VideoAspectRatio } from '../types';

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

export const analyzeImage = async (prompt: string, file: File): Promise<string> => {
    const ai = getAI();
    const imagePart = await fileToGenerativePart(file);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{text: prompt}, imagePart] },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
    });
    return response.text;
};

export const analyzeVideo = async (prompt: string, file: File): Promise<string> => {
    const ai = getAI();
    const videoPart = await fileToGenerativePart(file);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [{text: prompt}, videoPart] },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
    });
    return response.text;
};

export const editImage = async (prompt: string, file: File): Promise<string> => {
    const ai = getAI();
    const imagePart = await fileToGenerativePart(file);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, {text: prompt}] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    const resultPart = response.candidates?.[0].content.parts[0];
    if (resultPart && resultPart.inlineData) {
        return `data:${resultPart.inlineData.mimeType};base64,${resultPart.inlineData.data}`;
    }
    throw new Error("Could not edit image.");
};

export const generateWithThinking = async (prompt: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
          thinkingConfig: { thinkingBudget: 32768 },
          systemInstruction: SYSTEM_INSTRUCTION,
      }
  });
  return response.text;
};

export const generateWithSearch = async (prompt: string): Promise<{ text: string, sources: GroundingChunk[] }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
        systemInstruction: SYSTEM_INSTRUCTION,
      },
  });
  return { text: response.text, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const generateWithMaps = async (prompt: string, location: {latitude: number, longitude: number}): Promise<{ text: string, sources: GroundingChunk[] }> => {
    const ai = getAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{googleMaps: {}}],
            toolConfig: {
                retrievalConfig: {
                    latLng: location
                }
            },
            systemInstruction: SYSTEM_INSTRUCTION,
        }
    });
    return { text: response.text, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const ai = getAI();
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
  return `data:image/png;base64,${base64ImageBytes}`;
};

export const generateVideo = async (prompt: string, imageFile?: File, aspectRatio: VideoAspectRatio = '16:9'): Promise<string> => {
  if (typeof (window as any).aistudio === 'undefined') {
    throw new Error('AI Studio context not available. This feature requires the AI Studio environment.');
  }
  
  const hasApiKey = await (window as any).aistudio.hasSelectedApiKey();
  if (!hasApiKey) {
    await (window as any).aistudio.openSelectKey();
    // Re-check after the dialog is closed.
    const newHasApiKey = await (window as any).aistudio.hasSelectedApiKey();
    if (!newHasApiKey) {
      throw new Error("Veo requires an API key. Please select one to proceed.");
    }
  }

  const aiWithSelectedKey = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let imagePayload;
  if (imageFile) {
    const base64Data = (await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(imageFile);
    }));
    imagePayload = { imageBytes: base64Data, mimeType: imageFile.type };
  }

  let operation = await aiWithSelectedKey.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    ...(imagePayload && { image: imagePayload }),
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio,
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await aiWithSelectedKey.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("Video generation failed to produce a link.");
  
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const videoBlob = await videoResponse.blob();
  return URL.createObjectURL(videoBlob);
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

export const generateTts = async (text: string): Promise<void> => {
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

  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  const audioBytes = decode(base64Audio);
  const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
  
  const source = outputAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(outputAudioContext.destination);
  source.start();
};