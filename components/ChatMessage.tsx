import React, { useState, useRef, useEffect } from 'react';
import { Message, User } from '../types';
import { GrokIcon, SpeakerIcon, CopyIcon, CheckIcon, StopIcon } from '../constants';
import * as geminiService from '../services/geminiService';
import { useLanguage } from './LanguageProvider';

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
  const { t } = useLanguage();
  const contentRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
        isMounted.current = false;
        // If this component unmounts while its audio is playing, stop it.
        if (isPlaying) {
            geminiService.stopTts();
        }
    };
  }, [isPlaying]);

  useEffect(() => {
    if (contentRef.current && !message.isLoading && message.role === 'ai') {
        const preElements = contentRef.current.querySelectorAll('pre');
        preElements.forEach(pre => {
            if (pre.parentNode && (pre.parentNode as HTMLElement).classList.contains('code-block-wrapper')) {
                return; // Button already added
            }

            const code = pre.querySelector('code');
            if (!code) return;
            
            // Apply Grok-like styling to pre and code blocks
            pre.classList.add('bg-dark-input', 'p-4', 'rounded-lg', 'text-sm', 'overflow-x-auto');
            if(code) {
              code.classList.add('text-dark-text');
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper relative';

            const button = document.createElement('button');
            button.className = 'copy-code-btn absolute top-2 right-2 p-1.5 bg-dark-sidebar text-dark-secondary-text rounded-md hover:bg-dark-border hover:text-dark-text transition-all text-xs flex items-center gap-1';
            button.setAttribute('aria-label', 'Copy code');
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> <span>Copy</span>`;
            
            button.onclick = () => {
                navigator.clipboard.writeText(code.innerText);
                button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span>Copied!</span>`;
                setTimeout(() => {
                    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> <span>Copy</span>`;
                }, 2000);
            };
            
            pre.parentNode?.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(button);
        });
    }
  }, [message.text, message.isLoading, message.role]);


  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className={`px-4 py-2 rounded-lg text-sm max-w-md text-center ${message.isError ? 'bg-red-900/50 text-red-300' : 'bg-dark-input text-dark-secondary-text'}`}>
          {message.text}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  
  const handleTTS = () => {
    if (isPlaying) {
        geminiService.stopTts();
    } else {
        if (!message.originalTextForTTS) return;
        geminiService.playTts(message.originalTextForTTS, (playing) => {
            if (isMounted.current) {
                setIsPlaying(playing);
            }
        });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };
  
  const handleCopyImage = async () => {
    if (!message.image) return;
    try {
        const response = await fetch(message.image);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
        ]);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
        console.error('Failed to copy image to clipboard:', err);
        alert('Could not copy image automatically. Please right-click the image to copy.');
    }
  };

  const renderContent = () => {
    if (message.isLoading) {
      if (message.text) {
        return (
          <div className="flex items-end gap-2">
             <div 
                className="prose prose-sm dark:prose-invert max-w-none prose-p:text-dark-text prose-strong:text-dark-text" 
                dangerouslySetInnerHTML={{ __html: sanitizeAndRenderMarkdown(message.text) }}
             />
             <div className="w-2 h-4 bg-dark-accent animate-pulse mb-1"></div>
          </div>
        );
      }
      return <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-dark-accent rounded-full animate-pulse"></div>
        <div className="w-2 h-2 bg-dark-accent rounded-full animate-pulse delay-75"></div>
        <div className="w-2 h-2 bg-dark-accent rounded-full animate-pulse delay-150"></div>
      </div>;
    }

    if(message.image) {
        return (
            <div className="relative group">
                <img src={message.image} alt="Generated content" className="mt-2 rounded-lg max-w-sm" />
                <button 
                    onClick={handleCopyImage} 
                    className="absolute top-4 right-2 p-1.5 bg-black bg-opacity-60 rounded-md text-white transition-opacity"
                    title="Copy Image"
                    aria-label="Copy Image"
                >
                    {hasCopied ? <CheckIcon className="w-5 h-5 text-green-400"/> : <CopyIcon className="w-5 h-5"/>}
                </button>
            </div>
        );
    }
    
    if(message.video) {
        return <video src={message.video} controls className="mt-2 rounded-lg max-w-sm" />;
    }
    
    return (
      <div 
        ref={contentRef}
        className="prose prose-sm dark:prose-invert max-w-none prose-p:text-dark-text prose-strong:text-dark-text prose-headings:text-dark-text prose-a:text-dark-accent hover:prose-a:text-dark-accent-hover" 
        dangerouslySetInnerHTML={{ __html: sanitizeAndRenderMarkdown(message.text) }}
      />
    );
  };
  
  return (
    <div className={`flex items-start gap-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-dark-accent flex items-center justify-center flex-shrink-0"><GrokIcon className="w-5 h-5 text-white" /></div>}
      
      <div className={`max-w-xl w-full ${isUser ? 'order-1' : 'order-2'}`}>
        <div className={`px-4 py-3 rounded-2xl ${isUser ? 'bg-dark-user-msg text-white rounded-br-none' : 'bg-light-ai-msg dark:bg-dark-ai-msg rounded-bl-none'} ${message.isError ? 'bg-red-900/50 border border-red-500/50' : ''}`}>
          {renderContent()}
        </div>
        
        {!message.isLoading && !message.isError && (
          <div className={`mt-2 flex items-center gap-4 text-light-secondary-text dark:text-dark-secondary-text ${isUser ? 'justify-end' : ''}`}>
            
            {!isUser && message.originalTextForTTS && (
              <button onClick={handleTTS} disabled={!message.originalTextForTTS} className="hover:text-dark-accent disabled:opacity-50" title={isPlaying ? "Stop" : "Listen to message"}>
                {isPlaying ? <StopIcon className="w-5 h-5 text-red-500" /> : <SpeakerIcon className="w-5 h-5" />}
              </button>
            )}

            <button onClick={handleCopy} className="hover:text-dark-accent" title="Copy text">
              {hasCopied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5" />}
            </button>
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-semibold mb-1 text-dark-secondary-text">{t('chat.message.sources')}</h4>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, index) => (
                <a 
                  key={index} 
                  href={source.web?.uri || source.maps?.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs bg-dark-input px-2 py-1 rounded-md hover:bg-dark-border truncate max-w-[200px] text-dark-secondary-text hover:text-dark-text"
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