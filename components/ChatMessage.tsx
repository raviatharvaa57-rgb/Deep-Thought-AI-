import React, { useState } from 'react';
import { Message, User } from '../types';
import { PelicanIcon, SpeakerIcon, CopyIcon, CheckIcon } from '../constants';
import * as geminiService from '../services/geminiService';

// This function needs to be declared at a scope accessible by ChatMessage
// or imported if it's in a utils file.
const sanitizeAndRenderMarkdown = (text: string): string => {
  if (typeof (window as any).DOMPurify === 'undefined' || typeof (window as any).marked === 'undefined') {
    // Fallback for when scripts are not loaded
    return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  const rawMarkup = (window as any).marked.parse(text, { breaks: true, gfm: true });
  return (window as any).DOMPurify.sanitize(rawMarkup);
};


interface ChatMessageProps {
  message: Message;
  user: User;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, user }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className={`px-4 py-2 rounded-lg text-sm max-w-md text-center ${message.isError ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
          {message.text}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  
  const handleTTS = async () => {
    if (isPlaying || !message.originalTextForTTS) return;
    setIsPlaying(true);
    try {
      await geminiService.generateTts(message.originalTextForTTS);
    } catch (error) {
      console.error("TTS Error:", error);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const renderContent = () => {
    if (message.isLoading) {
      return <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
      </div>;
    }

    if(message.image) {
        return <img src={message.image} alt="Generated content" className="mt-2 rounded-lg max-w-sm" />;
    }
    
    if(message.video) {
        return <video src={message.video} controls className="mt-2 rounded-lg max-w-sm" />;
    }

    return (
      <div 
        className="prose prose-sm dark:prose-invert max-w-none" 
        dangerouslySetInnerHTML={{ __html: sanitizeAndRenderMarkdown(message.text) }}
      />
    );
  };
  
  return (
    <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center flex-shrink-0"><PelicanIcon className="w-5 h-5 text-white" /></div>}
      
      <div className={`max-w-xl w-full ${isUser ? 'order-1' : 'order-2'}`}>
        <div className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-light-user-msg dark:bg-dark-user-msg rounded-br-none' : 'bg-light-ai-msg dark:bg-dark-ai-msg rounded-bl-none'} ${message.isError ? 'bg-red-100 dark:bg-red-900 border border-red-500' : ''}`}>
          {renderContent()}
        </div>
        
        {!isUser && !message.isLoading && !message.isError && (
          <div className="mt-2 flex items-center gap-4 text-light-secondary-text dark:text-dark-secondary-text">
            {message.originalTextForTTS && (
              <button onClick={handleTTS} disabled={isPlaying} className="hover:text-blue-500 disabled:opacity-50" title="Listen to message">
                <SpeakerIcon className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
              </button>
            )}
            <button onClick={handleCopy} className="hover:text-blue-500">
              {hasCopied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5" />}
            </button>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-semibold mb-1">Sources:</h4>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <a 
                  key={index} 
                  href={source.web?.uri || source.maps?.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 truncate max-w-[200px]"
                >
                  {source.web?.title || source.maps?.title || 'Source'}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full flex-shrink-0 order-2" />}
    </div>
  );
};

export default ChatMessage;