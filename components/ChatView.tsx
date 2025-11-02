import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, User, Theme, ChatMode, AspectRatio } from '../types';
import ChatMessage from './ChatMessage';
import * as geminiService from '../services/geminiService';
import * as historyService from '../services/historyService';
import { SendIcon, MicIcon, AttachmentIcon, StopIcon, HamburgerIcon, SparklesIcon, EditIcon, BrainCircuitIcon, LiveIcon, ArrowUpTrayIcon, GrokIcon } from '../constants';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { useLanguage } from './LanguageProvider';
import HelpGuide from './HelpGuide';
import WelcomeGuide from './WelcomeGuide';

interface ChatViewProps {
  chatId: string;
  user: User;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  activeMode: ChatMode;
  setActiveMode: (mode: ChatMode) => void;
  onChatCreated: (chatId: string, title: string) => void;
}

const MAX_IMAGE_SIZE_MB = 20;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const AI_RESPONSE_SUMMARY_THRESHOLD = 1500;
const SUMMARIZE_THRESHOLD = 500;

type Attachment = {
  source: File | string;
  preview: string;
  type: 'image' | 'video';
};

const ChatView: React.FC<ChatViewProps> = ({ chatId, user, theme, setTheme, toggleSidebar, activeMode, setActiveMode, onChatCreated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<Attachment | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [fileError, setFileError] = useState<string | null>(null);
  const [showSummarize, setShowSummarize] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { t, language } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevActiveModeRef = useRef<ChatMode>();
  const { transcript, isListening, startListening, stopListening } = useSpeechRecognition(language);

  const handleRemoveAttachment = () => {
    setAttachedFile(null);
    setFileError(null);
    if ([ChatMode.AnalyzeImage, ChatMode.EditImage, ChatMode.AnalyzeVideo].includes(activeMode)) {
        setActiveMode(ChatMode.Chat);
    }
  };

  useEffect(() => {
    const loadedMessages = historyService.getChatMessages(chatId, user);
    setMessages(loadedMessages);
  }, [chatId, user]);

  useEffect(() => {
    if (messages.length > 0) {
      historyService.saveChatMessages(chatId, messages, user);
    }
  }, [messages, chatId, user]);

  useEffect(() => {
    if (prevActiveModeRef.current !== activeMode && activeMode !== ChatMode.Chat) {
      const modeMessages: Partial<Record<ChatMode, string>> = {
        [ChatMode.Study]: t('chat.mode.study'),
        [ChatMode.Thinking]: t('chat.mode.thinking'),
        [ChatMode.Search]: t('chat.mode.search'),
        [ChatMode.Maps]: t('chat.mode.maps'),
        [ChatMode.Imagine]: t('chat.mode.imagine'),
        [ChatMode.EditImage]: t('chat.mode.editImage'),
        [ChatMode.AnalyzeImage]: t('chat.mode.analyzeImage'),
        [ChatMode.AnalyzeVideo]: t('chat.mode.analyzeVideo'),
        [ChatMode.Live]: t('chat.mode.live'),
      };
      const messageText = modeMessages[activeMode];

      if (messageText && messages.length === 0) {
        const systemMessage: Message = { id: `msg-${Date.now()}-system`, role: 'system', text: messageText };
        setMessages(prev => [...prev, systemMessage]);
      }
    }
    prevActiveModeRef.current = activeMode;
  }, [activeMode, t, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  useEffect(() => { if (transcript) setInput(transcript); }, [transcript]);

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setActiveMode(newMode);
    if (![ChatMode.AnalyzeImage, ChatMode.EditImage, ChatMode.AnalyzeVideo].includes(newMode)) {
      setAttachedFile(null);
    }
  }, [setActiveMode]);
  
  const handleExampleClick = useCallback((example: string) => {
    setInput(example);
  }, []);

  const handleSummarize = useCallback(async () => {
    if (!input.trim()) return;
    if (messages.length === 0) onChatCreated(chatId, t('chat.summarize.request'));
    
    const textToSummarize = input;
    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', text: t('chat.summarize.request') };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');
    setShowSummarize(false);
    setFileError(null);

    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiMessagePlaceholder: Message = { id: aiMessageId, role: 'ai', text: '', isLoading: true };
    setMessages(prev => [...prev, aiMessagePlaceholder]);

    const updateAIMessage = (update: Partial<Message>) => {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, ...update } : m));
    };

    try {
      const summaryText = await geminiService.summarizeText(textToSummarize);
      updateAIMessage({ text: summaryText, originalTextForTTS: summaryText, isLoading: false });
    } catch (error) {
      console.error("Error summarizing text:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateAIMessage({ text: `Error: ${errorMessage}`, isLoading: false, isError: true });
    } finally {
      setIsLoading(false);
    }
  }, [input, messages.length, onChatCreated, chatId, t]);

  const handleSendMessage = useCallback(async (currentInput: string, currentMode: ChatMode, currentAttachment?: Attachment) => {
    if (!currentInput.trim() && !currentAttachment) return;

    if (messages.length === 0 || (messages.length === 1 && messages[0].role === 'system')) {
      const title = currentInput.substring(0, 40) + (currentInput.length > 40 ? '...' : '');
      onChatCreated(chatId, title);
    }

    const userMessage: Message = { 
      id: `msg-${Date.now()}`, 
      role: 'user', 
      text: currentInput, 
      image: currentAttachment?.type === 'image' ? currentAttachment.preview : undefined,
      video: currentAttachment?.type === 'video' ? currentAttachment.preview : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');
    setAttachedFile(null);
    setShowSummarize(false);
    setFileError(null);

    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiMessagePlaceholder: Message = { id: aiMessageId, role: 'ai', text: '', isLoading: true };
    setMessages(prev => [...prev, aiMessagePlaceholder]);

    const updateAIMessage = (update: Partial<Message>) => {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, ...update } : m));
    };

    try {
      const keyMap: Partial<Record<ChatMode, string>> = {
        [ChatMode.Imagine]: 'chat.loading.imagine',
        [ChatMode.EditImage]: 'chat.loading.editImage',
        [ChatMode.AnalyzeImage]: 'chat.loading.analyzeImage',
        [ChatMode.AnalyzeVideo]: 'chat.loading.analyzeVideo',
        [ChatMode.Search]: 'chat.loading.search',
        [ChatMode.Maps]: 'chat.loading.maps',
        [ChatMode.Thinking]: 'chat.loading.thinking',
      };
      const loadingMessageKey = keyMap[currentMode];
      if (loadingMessageKey) {
          updateAIMessage({ text: t(loadingMessageKey), isLoading: true });
      }

      let result: geminiService.AiFeatureResult = { text: '' };

      if (currentMode === ChatMode.Chat) {
        let responseText = '';
        for await (const chunk of geminiService.streamChatMessage(chatId, currentInput)) {
          responseText += chunk;
          updateAIMessage({ text: responseText, isLoading: true });
        }
        result = { text: responseText };
      } else {
        const options: geminiService.AiFeatureOptions = {
          prompt: currentInput,
          attachmentSource: currentAttachment?.source,
          aspectRatio: aspectRatio,
        };

        if (currentMode === ChatMode.Maps) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
          options.location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }

        result = await geminiService.executeAiFeature(currentMode, options);
      }
      
      const { text: responseText, sources: responseSources, image: responseImage } = result;
      
      const needsSummary = responseText.length > AI_RESPONSE_SUMMARY_THRESHOLD &&
                           [ChatMode.Chat, ChatMode.Study, ChatMode.Thinking, ChatMode.Search, ChatMode.Maps].includes(currentMode);

      if (needsSummary) {
        const textWithSummarizingMsg = `${responseText}\n\n---\n\n*${t('chat.summarizing')}*`;
        updateAIMessage({ text: textWithSummarizingMsg, originalTextForTTS: responseText, sources: responseSources, isLoading: true });
        
        try {
          const summary = await geminiService.summarizeText(responseText);
          const fullResponseWithSummary = `${responseText}\n\n---\n\n**✨ ${t('chat.summary.title')}**\n\n${summary}`;
          updateAIMessage({ text: fullResponseWithSummary, originalTextForTTS: responseText, sources: responseSources, image: responseImage, isLoading: false });
        } catch (summaryError) {
          console.error("Error generating summary:", summaryError);
          updateAIMessage({ text: responseText, originalTextForTTS: responseText, sources: responseSources, image: responseImage, isLoading: false });
        }
      } else {
        updateAIMessage({ text: responseText, originalTextForTTS: responseText, sources: responseSources, image: responseImage, isLoading: false });
      }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      if (errorMessage.toLowerCase().includes('failed to fetch')) {
        updateAIMessage({ text: t('chat.url.fetchError'), isLoading: false, isError: true });
      } else {
        updateAIMessage({ text: `Error: ${errorMessage}`, isLoading: false, isError: true });
      }
    } finally {
      setIsLoading(false);
      const oneShotModes = [ChatMode.Imagine, ChatMode.EditImage, ChatMode.AnalyzeImage, ChatMode.AnalyzeVideo];
      if (oneShotModes.includes(currentMode)) {
        handleModeChange(ChatMode.Chat);
      }
    }
  }, [messages.length, onChatCreated, chatId, aspectRatio, handleModeChange, t]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input, activeMode, attachedFile);
  };
  
  const handleUrlAttach = useCallback((url: string) => {
    setFileError(null);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExtensions = ['mp4', 'webm', 'mov', 'ogg'];
    const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';

    if (imageExtensions.includes(extension)) {
        const img = new Image();
        img.onload = () => {
            setAttachedFile({ source: url, preview: url, type: 'image' });
            setActiveMode(ChatMode.Chat);
        };
        img.onerror = () => setFileError(t('chat.url.invalid'));
        img.src = url;
    } else if (videoExtensions.includes(extension)) {
        const video = document.createElement('video');
        video.oncanplay = () => {
            setAttachedFile({ source: url, preview: url, type: 'video' });
            setActiveMode(ChatMode.AnalyzeVideo);
        };
        video.onerror = () => setFileError(t('chat.url.invalid'));
        video.src = url;
    } else {
        setFileError(t('chat.url.invalid'));
    }
  }, [t, setActiveMode]);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileError(null);
    const file = files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setFileError(t('chat.file.unsupportedType'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
      setFileError(t('chat.file.tooLargeImage', { size: MAX_IMAGE_SIZE_MB }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
        setFileError(t('chat.file.tooLargeVideo', { size: MAX_VIDEO_SIZE_MB }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({ source: file, preview: reader.result as string, type: isImage ? 'image' : 'video' });
        if (isVideo) {
          setActiveMode(ChatMode.AnalyzeVideo);
        } else {
          setActiveMode(ChatMode.Chat);
        }
      };
      reader.onerror = () => {
        setFileError(t('chat.file.uploadFailed'));
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('File read error:', error);
      setFileError(t('chat.file.uploadFailed'));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [t, setActiveMode]);
  
  useEffect(() => {
    const dragCounter = { current: 0 };
    const handleDragEnter = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) setIsDraggingOver(true); };
    const handleDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsDraggingOver(false); };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); dragCounter.current = 0; if (e.dataTransfer?.files) handleFileUpload(e.dataTransfer.files); };
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFileUpload]);

  const handleCommand = useCallback((command: string) => {
    setInput('');
    const modeMap: Record<string, ChatMode> = { 
      '/study': ChatMode.Study, '/think': ChatMode.Thinking, '/search': ChatMode.Search, 
      '/maps': ChatMode.Maps, '/imagine': ChatMode.Imagine, '/live': ChatMode.Live,
    };
    if (modeMap[command]) handleModeChange(modeMap[command]);
  }, [handleModeChange]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInput = e.target.value;
    setInput(currentInput);
    const isLongEnough = currentInput.trim().length > SUMMARIZE_THRESHOLD;
    const isSummarizableMode = activeMode === ChatMode.Chat || activeMode === ChatMode.Study;
    const isUserLoggedIn = !!user.email;
    setShowSummarize(isLongEnough && isSummarizableMode && isUserLoggedIn);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const URL_REGEX = /^(https?:\/\/[^\s]+?\.(?:jpg|jpeg|gif|png|webp|mp4|mov|avi|webm))/i;
    const match = pastedText.trim().match(URL_REGEX);
    if (match) {
        e.preventDefault();
        handleUrlAttach(match[0]);
    }
  };

  useEffect(() => {
    const command = ['/study', '/think', '/search', '/maps', '/imagine', '/live'].find(c => c === input.trim());
    if (command) {
      if (!user.email) {
        const systemMessage: Message = { id: `msg-${Date.now()}-system`, role: 'system', text: 'AI features are available for signed-in users only. Please sign in to use commands.', isError: true };
        setMessages(prev => [...prev, systemMessage]);
        setInput('');
        return;
      }
      handleCommand(command);
    }
  }, [input, user.email, handleCommand]);
  
  const renderAspectRatioSelector = (options: string[], selected: string, setter: (val: any) => void) => (
    <div className="mb-2 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-light-secondary-text dark:text-dark-secondary-text">{t('chat.aspectRatio')}</span>
        {options.map(ratio => <button key={ratio} onClick={() => setter(ratio)} className={`px-3 py-1 text-sm rounded-full ${selected === ratio ? 'bg-dark-accent text-white' : 'bg-light-input dark:bg-dark-input hover:bg-light-border dark:hover:bg-dark-border'}`}>{ratio}</button>)}
    </div>
  );

  const getPlaceholderText = useCallback(() => {
    if (isListening) return t('chat.listening');
    
    const placeholderKeyMap: Partial<Record<ChatMode, string>> = {
        [ChatMode.Chat]: 'chat.placeholder.url',
        [ChatMode.Study]: 'chat.placeholder.study',
        [ChatMode.Thinking]: 'chat.placeholder.thinking',
        [ChatMode.Search]: 'chat.placeholder.search',
        [ChatMode.Maps]: 'chat.placeholder.maps',
        [ChatMode.Imagine]: 'chat.placeholder.imagine',
        [ChatMode.EditImage]: 'chat.placeholder.editImage',
        [ChatMode.AnalyzeImage]: 'chat.placeholder.analyzeImage',
        [ChatMode.AnalyzeVideo]: 'chat.placeholder.analyzeVideo',
    };

    const key = placeholderKeyMap[activeMode] || 'chat.placeholder.url';
    return t(key);
  }, [isListening, activeMode, t]);

  const fileRequiredModes = [ChatMode.AnalyzeImage, ChatMode.EditImage, ChatMode.AnalyzeVideo];
  const isFileRequiredMode = fileRequiredModes.includes(activeMode);
  const isSendDisabled = isLoading || (!input.trim() && !attachedFile) || (isFileRequiredMode && !attachedFile);

  return (
    <div className="relative flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      {isDraggingOver && (
        <div className="absolute inset-0 bg-dark-accent bg-opacity-70 dark:bg-dark-accent dark:bg-opacity-80 z-10 flex flex-col items-center justify-center transition-opacity">
          <div className="text-center p-8 border-2 border-dashed border-white rounded-xl pointer-events-none">
            <ArrowUpTrayIcon className="w-16 h-16 text-white mx-auto mb-4" />
            <p className="text-white text-xl font-semibold">{t('chat.dropMessage')}</p>
          </div>
        </div>
      )}
      <header className="flex items-center p-4 border-b border-light-border dark:border-dark-border">
        <button onClick={toggleSidebar} className="md:hidden mr-4 p-1"><HamburgerIcon className="w-6 h-6" /></button>
        <GrokIcon className="w-8 h-8 mr-3 text-light-text dark:text-dark-text" />
        <h1 className="text-lg font-semibold flex-1">{t('welcome.title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
            user.email ? (
                <WelcomeGuide user={user} onExampleClick={handleExampleClick} />
            ) : (
                <HelpGuide />
            )
        ) : (
            <div className="space-y-6">
                {messages.map((message) => <ChatMessage key={message.id} message={message} user={user} />)}
                <div ref={messagesEndRef} />
            </div>
        )}
      </div>

      <div className="p-4 md:p-6 border-t border-light-border dark:border-dark-border">
        {user.email && activeMode === ChatMode.Imagine && renderAspectRatioSelector(['1:1', '16:9', '9:16', '4:3', '3:4'], aspectRatio, setAspectRatio)}
        
        {attachedFile && (
          <div className="relative mb-2 p-2 bg-light-input dark:bg-dark-input rounded-lg flex items-center gap-4">
            {attachedFile.type === 'image' ? (
              <img src={attachedFile.preview} className="w-16 h-16 object-cover rounded-md" alt="attachment preview" />
            ) : (
              <video src={attachedFile.preview} className="w-16 h-16 object-cover rounded-md bg-black" muted playsInline />
            )}
            <div className="flex-1 flex flex-wrap gap-2">
                {user.email ? (
                    <>
                      {attachedFile.type === 'image' && <>
                        <button onClick={() => setActiveMode(ChatMode.AnalyzeImage)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.AnalyzeImage ? 'bg-dark-accent text-white' : 'bg-light-border dark:bg-dark-border'}`}><BrainCircuitIcon className="w-4 h-4" />{t('chat.attachment.analyze')}</button>
                        <button onClick={() => setActiveMode(ChatMode.EditImage)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.EditImage ? 'bg-dark-accent text-white' : 'bg-light-border dark:bg-dark-border'}`}><EditIcon className="w-4 h-4" />{t('chat.attachment.edit')}</button>
                      </>}
                      {attachedFile.type === 'video' &&
                        <button onClick={() => setActiveMode(ChatMode.AnalyzeVideo)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.AnalyzeVideo ? 'bg-dark-accent text-white' : 'bg-light-border dark:bg-dark-border'}`}><LiveIcon className="w-4 h-4" />{t('chat.attachment.analyzeVideo')}</button>
                      }
                    </>
                ) : (
                    <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text p-1">{t('chat.attachment.guest')}</p>
                )}
            </div>
            <button onClick={handleRemoveAttachment} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs">&times;</button>
          </div>
        )}

        {fileError && <div className="mb-2 text-center text-red-500 dark:text-red-400 text-sm" role="alert">{fileError}</div>}
        
        {showSummarize && !isLoading && (
            <div className="flex justify-center mb-2">
                <button onClick={handleSummarize} className="px-4 py-2 bg-dark-accent text-white font-semibold rounded-lg shadow-md hover:bg-dark-accent-hover transition-colors text-sm flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />{t('chat.summarize')}
                </button>
            </div>
        )}

        <form onSubmit={handleFormSubmit}>
          <div className="relative flex items-center w-full bg-light-input dark:bg-dark-input rounded-2xl p-2 focus-within:ring-2 focus-within:ring-dark-accent">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-light-secondary-text dark:text-dark-secondary-text hover:text-dark-accent"><AttachmentIcon className="w-6 h-6" /></button>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files)} className="hidden" accept="image/*,video/*" />
            
            <input type="text" value={input} onChange={handleInputChange} onPaste={handlePaste} placeholder={getPlaceholderText()} className="flex-1 bg-transparent focus:outline-none px-2 text-light-text dark:text-dark-text" disabled={isLoading} />
            
            <button type="button" onClick={isListening ? stopListening : startListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white' : 'text-light-secondary-text dark:text-dark-secondary-text hover:text-dark-accent'}`}>{isListening ? <StopIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}</button>
            <button type="submit" className="p-2 bg-dark-accent text-white rounded-full hover:bg-dark-accent-hover disabled:bg-gray-500 disabled:cursor-not-allowed ml-2" disabled={isSendDisabled}><SendIcon className="w-5 h-5" /></button>
          </div>
        </form>
        <p className="text-center text-xs text-light-secondary-text dark:text-dark-secondary-text mt-2">
            {t('chat.disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default ChatView;
