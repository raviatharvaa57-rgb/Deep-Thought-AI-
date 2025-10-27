
import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import LiveConversation from './LiveConversation';
import { User, Theme, ChatMode, ChatHistoryItem } from '../types';
import * as historyService from '../services/historyService';

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

  useEffect(() => {
    const userHistory = historyService.getHistory(user);
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

  if (activeMode === ChatMode.Live) {
    return <LiveConversation onExit={() => setActiveMode(ChatMode.Chat)} />;
  }

  return (
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
  );
};

export default Dashboard;