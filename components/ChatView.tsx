
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, User, Theme, ChatMode, AspectRatio, VideoAspectRatio } from '../types';
import ChatMessage from './ChatMessage';
import * as geminiService from '../services/geminiService';
import * as historyService from '../services/historyService';
import ThemeToggle from './ThemeToggle';
import { SendIcon, MicIcon, AttachmentIcon, StopIcon, HamburgerIcon, SparklesIcon, SearchIcon, MapIcon, ImageIcon, VideoIcon, EditIcon, BrainCircuitIcon, LiveIcon } from '../constants';
import useSpeechRecognition from '../hooks/useSpeechRecognition';
import { useLanguage } from './LanguageProvider';

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

const ChatView: React.FC<ChatViewProps> = ({ chatId, user, theme, setTheme, toggleSidebar, activeMode, setActiveMode, onChatCreated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ file: File, preview: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>('16:9');
  const { t } = useLanguage();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { transcript, isListening, startListening, stopListening } = useSpeechRecognition();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages for the current chat
  useEffect(() => {
    const loadedMessages = historyService.getChatMessages(chatId, user);
    setMessages(loadedMessages);
  }, [chatId, user]);

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      historyService.saveChatMessages(chatId, messages, user);
    }
  }, [messages, chatId, user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);
  useEffect(() => { if (transcript) setInput(transcript); }, [transcript]);

  const getModeInfo = useCallback((mode: ChatMode) => {
    if (attachedFile && mode !== ChatMode.EditImage && mode !== ChatMode.AnalyzeImage && mode !== ChatMode.ImageToVideo && mode !== ChatMode.AnalyzeVideo) {
       if (!user.email) {
        return { icon: AttachmentIcon, text: t('chat.fileAttached.guest') };
      }
      return { icon: AttachmentIcon, text: t('chat.fileAttached') };
    }
    const defaultInfo = { icon: SparklesIcon, text: t('chat.initial.greeting') };
    const modeMap: Record<ChatMode, { icon: React.FC<any>, text: string }> = {
      [ChatMode.Chat]: defaultInfo,
      [ChatMode.Thinking]: { icon: BrainCircuitIcon, text: t('chat.mode.thinking') },
      [ChatMode.Search]: { icon: SearchIcon, text: t('chat.mode.search') },
      [ChatMode.Maps]: { icon: MapIcon, text: t('chat.mode.maps') },
      [ChatMode.Imagine]: { icon: ImageIcon, text: t('chat.mode.imagine') },
      [ChatMode.EditImage]: { icon: EditIcon, text: t('chat.mode.editImage') },
      [ChatMode.AnalyzeImage]: { icon: ImageIcon, text: t('chat.mode.analyzeImage') },
      [ChatMode.AnalyzeVideo]: { icon: BrainCircuitIcon, text: t('chat.mode.analyzeVideo') },
      [ChatMode.Video]: { icon: VideoIcon, text: t('chat.mode.video') },
      [ChatMode.ImageToVideo]: { icon: VideoIcon, text: t('chat.mode.imageToVideo') },
      [ChatMode.Live]: { icon: LiveIcon, text: t('chat.mode.live') },
    };
    return modeMap[mode] || defaultInfo;
  }, [attachedFile, user.email, t]);

  const handleModeChange = useCallback((newMode: ChatMode) => {
    setActiveMode(newMode);
    if (![ChatMode.AnalyzeImage, ChatMode.EditImage, ChatMode.ImageToVideo, ChatMode.AnalyzeVideo].includes(newMode)) {
      setAttachedFile(null);
    }
  }, [setActiveMode]);

  const handleSendMessage = useCallback(async (currentInput: string, currentMode: ChatMode, currentFile?: File) => {
    if (!currentInput.trim() && !currentFile) return;

    if (messages.length === 0) {
      const title = currentInput.substring(0, 40) + (currentInput.length > 40 ? '...' : '');
      onChatCreated(chatId, title);
    }

    const userMessage: Message = { id: `msg-${Date.now()}`, role: 'user', text: currentInput, image: attachedFile?.preview };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInput('');
    setAttachedFile(null);

    const aiMessageId = `msg-${Date.now()}-ai`;
    const aiMessagePlaceholder: Message = { id: aiMessageId, role: 'ai', text: '', isLoading: true };
    setMessages(prev => [...prev, aiMessagePlaceholder]);

    const updateAIMessage = (update: Partial<Message>) => {
      setMessages(prev => prev.map(m => m.id === aiMessageId ? { ...m, ...update } : m));
    };

    try {
      let responseText = '';
      let responseSources: any[] = [];
      let responseImage: string | undefined = undefined;
      let responseVideo: string | undefined = undefined;

      switch (currentMode) {
        case ChatMode.Chat:
          for await (const chunk of geminiService.streamChatMessage(chatId, currentInput)) { responseText += chunk; updateAIMessage({ text: responseText, isLoading: true }); }
          break;
        case ChatMode.Thinking:
          responseText = await geminiService.generateWithThinking(currentInput);
          break;
        case ChatMode.Search:
          const searchResult = await geminiService.generateWithSearch(currentInput);
          responseText = searchResult.text; responseSources = searchResult.sources;
          break;
        case ChatMode.Maps:
          const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
          const mapsResult = await geminiService.generateWithMaps(currentInput, { latitude: position.coords.latitude, longitude: position.coords.longitude });
          responseText = mapsResult.text; responseSources = mapsResult.sources;
          break;
        case ChatMode.Imagine:
          responseImage = await geminiService.generateImage(currentInput, aspectRatio);
          responseText = "Here is the image you requested.";
          break;
        case ChatMode.AnalyzeImage:
          if (!currentFile) throw new Error('No image file provided for analysis.');
          responseText = await geminiService.analyzeImage(currentInput, currentFile);
          break;
        case ChatMode.AnalyzeVideo:
            if (!currentFile) throw new Error('No video file provided for analysis.');
            responseText = await geminiService.analyzeVideo(currentInput, currentFile);
            break;
        case ChatMode.EditImage:
          if (!currentFile) throw new Error('No image file provided for editing.');
          responseImage = await geminiService.editImage(currentInput, currentFile);
          responseText = "Here is the edited image.";
          break;
        case ChatMode.Video:
          responseVideo = await geminiService.generateVideo(currentInput, undefined, videoAspectRatio);
          responseText = "Your video is ready!";
          break;
        case ChatMode.ImageToVideo:
          if (!currentFile) throw new Error('No image file provided for video generation.');
          responseVideo = await geminiService.generateVideo(currentInput, currentFile, videoAspectRatio);
          responseText = "Your video generated from the image is ready!";
          break;
      }
      updateAIMessage({ text: responseText, originalTextForTTS: responseText, sources: responseSources, image: responseImage, video: responseVideo, isLoading: false });
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      updateAIMessage({ text: `Error: ${errorMessage}`, isLoading: false, isError: true });
    } finally {
      setIsLoading(false);
      handleModeChange(ChatMode.Chat);
    }
  }, [messages.length, onChatCreated, chatId, attachedFile, aspectRatio, videoAspectRatio, handleModeChange]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input, activeMode, attachedFile?.file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({ file, preview: reader.result as string });
        setActiveMode(ChatMode.Chat); // Reset mode to neutral to show options
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCommand = useCallback((command: string) => {
    setInput('');
    const modeMap: Record<string, ChatMode> = { 
      '/think': ChatMode.Thinking, 
      '/search': ChatMode.Search, 
      '/maps': ChatMode.Maps, 
      '/imagine': ChatMode.Imagine, 
      '/video': ChatMode.Video, 
      '/live': ChatMode.Live,
      '/analyzeimage': ChatMode.AnalyzeImage,
      '/analyzevideo': ChatMode.AnalyzeVideo,
    };
    if (modeMap[command]) handleModeChange(modeMap[command]);
  }, [handleModeChange]);

  useEffect(() => {
    const command = ['/think', '/search', '/maps', '/imagine', '/video', '/live', '/analyzeimage', '/analyzevideo'].find(c => c === input.trim());
    if (command) {
      if (!user.email) {
        const systemMessage: Message = {
          id: `msg-${Date.now()}-system`,
          role: 'system',
          text: 'AI features are available for signed-in users only. Please sign in to use commands.',
          isError: true,
        };
        setMessages(prev => [...prev, systemMessage]);
        setInput('');
        return;
      }
      handleCommand(command);
    }
  }, [input, user.email, handleCommand]);

  const currentModeInfo = getModeInfo(activeMode);
  
  const renderAspectRatioSelector = (options: string[], selected: string, setter: (val: any) => void) => (
    <div className="mb-2 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-light-secondary-text dark:text-dark-secondary-text">{t('chat.aspectRatio')}</span>
        {options.map(ratio => (
            <button key={ratio} onClick={() => setter(ratio)} className={`px-3 py-1 text-sm rounded-full ${selected === ratio ? 'bg-blue-600 text-white' : 'bg-light-input dark:bg-dark-input hover:bg-light-border dark:hover:bg-dark-border'}`}>
                {ratio}
            </button>
        ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-light-bg dark:bg-dark-bg">
      <header className="flex items-center p-4 border-b border-light-border dark:border-dark-border">
        <button onClick={toggleSidebar} className="md:hidden mr-4 p-1"><HamburgerIcon className="w-6 h-6" /></button>
        <h1 className="text-lg font-semibold flex-1">{t('welcome.title')}</h1>
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 mb-4">{React.createElement(currentModeInfo.icon, { className: "w-full h-full text-gray-400" })}</div>
            <p className="text-lg text-light-secondary-text dark:text-dark-secondary-text">{currentModeInfo.text}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => <ChatMessage key={message.id} message={message} user={user} />)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 border-t border-light-border dark:border-dark-border">
        {user.email && activeMode === ChatMode.Imagine && renderAspectRatioSelector(['1:1', '16:9', '9:16', '4:3', '3:4'], aspectRatio, setAspectRatio)}
        {user.email && (activeMode === ChatMode.Video || activeMode === ChatMode.ImageToVideo) && renderAspectRatioSelector(['16:9', '9:16'], videoAspectRatio, setVideoAspectRatio)}

        {attachedFile && (
          <div className="relative mb-2 p-2 bg-light-input dark:bg-dark-input rounded-lg flex items-center gap-4">
            {attachedFile.file.type.startsWith('image/') ? (
                <img src={attachedFile.preview} className="w-16 h-16 object-cover rounded-md" alt="attachment preview" />
            ) : (
                <div className="w-16 h-16 bg-gray-500 dark:bg-gray-700 flex items-center justify-center rounded-md flex-shrink-0">
                    <VideoIcon className="w-8 h-8 text-white" />
                </div>
            )}
            <div className="flex-1 flex flex-wrap gap-2">
                {user.email && attachedFile.file.type.startsWith('image/') ? (
                    <>
                        <button onClick={() => setActiveMode(ChatMode.AnalyzeImage)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.AnalyzeImage ? 'bg-blue-600 text-white' : 'bg-light-border dark:bg-dark-border'}`}><ImageIcon className="w-4 h-4" />{t('chat.attachment.analyze')}</button>
                        <button onClick={() => setActiveMode(ChatMode.EditImage)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.EditImage ? 'bg-blue-600 text-white' : 'bg-light-border dark:bg-dark-border'}`}><EditIcon className="w-4 h-4" />{t('chat.attachment.edit')}</button>
                        <button onClick={() => setActiveMode(ChatMode.ImageToVideo)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.ImageToVideo ? 'bg-blue-600 text-white' : 'bg-light-border dark:bg-dark-border'}`}><VideoIcon className="w-4 h-4" />{t('chat.attachment.animate')}</button>
                    </>
                ) : user.email && attachedFile.file.type.startsWith('video/') ? (
                    <button onClick={() => setActiveMode(ChatMode.AnalyzeVideo)} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${activeMode === ChatMode.AnalyzeVideo ? 'bg-blue-600 text-white' : 'bg-light-border dark:bg-dark-border'}`}><BrainCircuitIcon className="w-4 h-4" />{t('chat.attachment.analyzeVideo')}</button>
                ) : !user.email ? (
                    <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text p-1">
                      {t('chat.attachment.guest')}
                    </p>
                ) : null}
            </div>
            <button onClick={() => setAttachedFile(null)} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs">&times;</button>
          </div>
        )}
        <form onSubmit={handleFormSubmit} className="relative">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isListening ? t('chat.listening') : t('chat.placeholder')} className="w-full pl-12 pr-28 py-3 rounded-full bg-light-input dark:bg-dark-input focus:ring-2 focus:ring-blue-500 focus:outline-none" disabled={isLoading} />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-light-secondary-text dark:text-dark-secondary-text hover:text-blue-500"><AttachmentIcon className="w-6 h-6" /></button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*" />
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
            <button type="button" onClick={isListening ? stopListening : startListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white' : 'text-light-secondary-text dark:text-dark-secondary-text hover:text-blue-500'}`}>{isListening ? <StopIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}</button>
            <button type="submit" className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed" disabled={isLoading || (!input.trim() && !attachedFile)}><SendIcon className="w-5 h-5" /></button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatView;