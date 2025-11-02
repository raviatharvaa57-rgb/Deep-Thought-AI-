
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import LiveConversation from './LiveConversation';
import ConfirmationModal from './ConfirmationModal';
import { User, Theme, ChatMode, ChatHistoryItem } from '../types';
import * as historyService from '../services/historyService';
import { useLanguage } from './LanguageProvider';

interface DashboardProps {
  user: User;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, theme, setTheme, onLogout, onUpdateUser }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(() => `chat-${Date.now()}`);
  const [activeMode, setActiveMode] = useState<ChatMode>(ChatMode.Chat);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSingleDeleteModalOpen, setIsSingleDeleteModalOpen] = useState(false);
  const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const userHistory = historyService.getHistory(user);
    
    // Check for chats older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const hasOldChats = userHistory.some(chat => chat.timestamp < thirtyDaysAgo);
    if (hasOldChats) {
      setIsDeleteModalOpen(true);
    }

    setHistory(userHistory);
    // Select the most recent chat or start a new one
    if (userHistory.length > 0) {
      setCurrentChatId(userHistory[0].id);
    } else {
      setCurrentChatId(`chat-${Date.now()}`);
    }
  }, [user]);

  const startNewChat = (mode: ChatMode = ChatMode.Chat) => {
    setActiveMode(mode);
    setCurrentChatId(`chat-${Date.now()}`);
  };

  const selectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setActiveMode(ChatMode.Chat); // Reset mode when switching chats
  };
  
  const handleChatCreated = (chatId: string, title: string) => {
    const newHistoryItem: ChatHistoryItem = { id: chatId, title, timestamp: Date.now() };
    // Check if chat already exists in history before adding
    if (!history.some(item => item.id === chatId)) {
        const updatedHistory = [newHistoryItem, ...history];
        setHistory(updatedHistory);
        historyService.saveHistory(user, updatedHistory);
    }
  };

  const handleClearHistory = () => {
    historyService.clearAllHistory(user);
    setHistory([]);
    startNewChat();
  };

  const handleConfirmDeleteOldHistory = () => {
    const updatedHistory = historyService.deleteOldHistory(user);
    setHistory(updatedHistory);
    setIsDeleteModalOpen(false);
    // If the current chat was deleted, start a new one
    if (!updatedHistory.some(chat => chat.id === currentChatId)) {
        startNewChat();
    }
  };

  const handleCancelDeleteOldHistory = () => {
    setIsDeleteModalOpen(false);
  };

  const handleRequestDeleteChat = (chatId: string) => {
    setChatToDeleteId(chatId);
    setIsSingleDeleteModalOpen(true);
  };

  const handleConfirmDeleteChat = () => {
    if (!chatToDeleteId) return;
    const updatedHistory = historyService.deleteChat(user, chatToDeleteId);
    setHistory(updatedHistory);
    setIsSingleDeleteModalOpen(false);
    
    if (currentChatId === chatToDeleteId) {
        if (updatedHistory.length > 0) {
            setCurrentChatId(updatedHistory[0].id);
        } else {
            startNewChat();
        }
    }
    setChatToDeleteId(null);
  };

  const handleCancelDeleteChat = () => {
    setIsSingleDeleteModalOpen(false);
    setChatToDeleteId(null);
  };

  const handleShareChat = async (chatId: string) => {
    const messages = historyService.getChatMessages(chatId, user);
    if (messages.length === 0) return;

    const formattedContent = messages
      .filter(msg => msg.role === 'user' || msg.role === 'ai')
      .map(msg => `${msg.role === 'user' ? 'You' : 'Deep Thought AI'}:\n${msg.originalTextForTTS || msg.text}`)
      .join('\n\n---\n\n');
    
    const shareData = {
      title: `Chat with Deep Thought AI`,
      text: formattedContent,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(formattedContent);
        alert(t('history.share.success'));
      }
    } catch (err) {
      console.error('Share failed:', err);
      try {
        await navigator.clipboard.writeText(formattedContent);
        alert(t('history.share.success'));
      } catch (copyErr) {
        console.error('Clipboard copy failed:', copyErr);
        alert('Failed to share or copy chat.');
      }
    }
  };

  if (activeMode === ChatMode.Live) {
    return <LiveConversation onExit={() => setActiveMode(ChatMode.Chat)} />;
  }

  return (
    <>
      <div className="flex h-screen w-full bg-light-bg dark:bg-dark-bg">
        <Sidebar
          user={user}
          onNewChat={startNewChat}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          onLogout={onLogout}
          history={history}
          onSelectChat={selectChat}
          currentChatId={currentChatId}
          onUpdateUser={onUpdateUser}
          theme={theme}
          setTheme={setTheme}
          onClearHistory={handleClearHistory}
          onDeleteChat={handleRequestDeleteChat}
          onShareChat={handleShareChat}
        />
        <main className="flex-1 flex flex-col h-screen transition-all duration-300">
          <ChatView
            key={currentChatId} // Add key to force re-mount on chat change
            chatId={currentChatId}
            user={user}
            theme={theme}
            setTheme={setTheme}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            onChatCreated={handleChatCreated}
          />
        </main>
      </div>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDeleteOldHistory}
        onConfirm={handleConfirmDeleteOldHistory}
        title={t('history.autoDelete.title')}
        message={t('history.autoDelete.message')}
        confirmText={t('history.autoDelete.confirm')}
        cancelText={t('history.autoDelete.cancel')}
      />
      <ConfirmationModal
        isOpen={isSingleDeleteModalOpen}
        onClose={handleCancelDeleteChat}
        onConfirm={handleConfirmDeleteChat}
        title={t('history.delete.title')}
        message={t('history.delete.message')}
        confirmText={t('history.delete.confirm')}
        cancelText={t('profile.cancel')}
      />
    </>
  );
};

export default Dashboard;