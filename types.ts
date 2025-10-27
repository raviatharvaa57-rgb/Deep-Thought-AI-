
export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi';

export interface User {
  firstName: string;
  lastName: string;
  avatar: string;
  email?: string;
  isNewUser?: boolean;
}

// Fix: Add types for Google Sign-In credential response and decoded JWT
export interface CredentialResponse {
  credential?: string;
}

export interface DecodedJwt {
  name: string;
  picture: string;
  email: string;
}

export type MessageRole = 'user' | 'ai' | 'system';

export enum ChatMode {
  Chat = 'CHAT',
  Thinking = 'THINKING',
  Search = 'SEARCH',
  Maps = 'MAPS',
  Imagine = 'IMAGINE',
  EditImage = 'EDIT_IMAGE',
  AnalyzeImage = 'ANALYZE_IMAGE',
  AnalyzeVideo = 'ANALYZE_VIDEO',
  Video = 'VIDEO',
  ImageToVideo = 'IMAGE_TO_VIDEO',
  Live = 'LIVE',
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets: {
        uri: string;
        text: string;
      }[];
    }[];
  };
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  image?: string;
  video?: string;
  isLoading?: boolean;
  isError?: boolean;
  sources?: GroundingChunk[];
  originalTextForTTS?: string;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  timestamp: number;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type VideoAspectRatio = "16:9" | "9:16";