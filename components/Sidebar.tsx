
import React, { useState } from 'react';
import { User, ChatHistoryItem, ChatMode, Theme } from '../types';
import { 
  PelicanIcon, 
  PlusIcon, 
  ChatBubbleIcon, 
  MoreIcon, 
  LogoutIcon, 
  ChevronLeftIcon,
  BrainCircuitIcon,
  SearchIcon,
  MapIcon,
  ImageIcon,
  VideoIcon,
  LiveIcon,
  UserCircleIcon,
  SettingsIcon
} from '../constants';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import { useLanguage } from './LanguageProvider';

interface SidebarProps {
  user: User;
  onNewChat: (mode?: ChatMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  onLogout: () => void;
  history: ChatHistoryItem[];
  onSelectChat: (chatId: string) => void;
  currentChatId: string;
  onUpdateUser: (user: User) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onClearHistory: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onNewChat, isSidebarOpen, setIsSidebarOpen, onLogout, history, onSelectChat, currentChatId, onUpdateUser, theme, setTheme, onClearHistory }) => {
  const { t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const aiFeatures = [
    { label: 'Thinking Mode', icon: BrainCircuitIcon, mode: ChatMode.Thinking },
    { label: 'Web Search', icon: SearchIcon, mode: ChatMode.Search },
    { label: 'Maps Search', icon: MapIcon, mode: ChatMode.Maps },
    { label: 'Generate Image', icon: ImageIcon, mode: ChatMode.Imagine },
    { label: 'Analyze Image', icon: ImageIcon, mode: ChatMode.AnalyzeImage },
    { label: 'Generate Video', icon: VideoIcon, mode: ChatMode.Video },
    { label: 'Analyze Video', icon: BrainCircuitIcon, mode: ChatMode.AnalyzeVideo },
    { label: 'Live Talk', icon: LiveIcon, mode: ChatMode.Live },
  ];

  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-light-sidebar dark:bg-dark-sidebar border-r border-light-border dark:border-dark-border transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex md:flex-col`}>
        <div className="flex flex-col flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNewChat()}
              className="flex items-center w-full p-2 text-sm font-semibold text-light-text dark:text-dark-text bg-light-bg dark:bg-dark-bg rounded-md hover:bg-light-border dark:hover:bg-dark-border transition-colors"
            >
              <PlusIcon className="w-5 h-5 mr-3" />
              {t('sidebar.newChat')}
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1">
              <ChevronLeftIcon className="w-6 h-6" />
            </button>
          </div>

          {user.email && (
            <div className="mb-6">
              <h2 className="px-2 text-xs font-semibold text-light-secondary-text dark:text-dark-secondary-text uppercase tracking-wider mb-2">{t('sidebar.aiFeatures')}</h2>
              <div className="space-y-1">
                {aiFeatures.map((feature) => (
                  <button
                    key={feature.label}
                    onClick={() => onNewChat(feature.mode)}
                    className="flex items-center w-full p-2 text-sm text-left rounded-md text-light-secondary-text dark:text-dark-secondary-text hover:bg-light-border dark:hover:bg-dark-border hover:text-light-text dark:hover:text-dark-text transition-colors"
                  >
                    {React.createElement(feature.icon, { className: 'w-5 h-5 mr-3 flex-shrink-0' })}
                    <span className="truncate">{feature.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <nav className="flex-1">
            <h2 className="px-2 text-xs font-semibold text-light-secondary-text dark:text-dark-secondary-text uppercase tracking-wider mb-2">{t('sidebar.history')}</h2>
            <div className="space-y-1">
              {history.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`flex items-center w-full p-2 text-sm text-left rounded-md transition-colors ${
                    currentChatId === chat.id
                      ? 'bg-light-border dark:bg-dark-border text-light-text dark:text-dark-text'
                      : 'text-light-secondary-text dark:text-dark-secondary-text hover:bg-light-border dark:hover:bg-dark-border'
                  }`}
                >
                  <ChatBubbleIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="mt-auto">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center w-full p-2 text-sm text-light-text dark:text-dark-text rounded-md hover:bg-light-border dark:hover:bg-dark-border"
              >
                <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full mr-3" />
                <span className="flex-1 text-left truncate">{`${user.firstName} ${user.lastName}`}</span>
                <MoreIcon className="w-5 h-5" />
              </button>
              {showUserMenu && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                  <button
                    onClick={() => { setIsProfileModalOpen(true); setShowUserMenu(false); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <UserCircleIcon className="w-5 h-5 mr-3" />
                    {t('sidebar.user.profile')}
                  </button>
                  <button
                    onClick={() => { setIsSettingsModalOpen(true); setShowUserMenu(false); }}
                    className="flex items-center w-full px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <SettingsIcon className="w-5 h-5 mr-3" />
                    {t('sidebar.user.settings')}
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LogoutIcon className="w-5 h-5 mr-3" />
                    {t('sidebar.user.logout')}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center mt-4 p-2">
              <PelicanIcon className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdateUser={onUpdateUser}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        setTheme={setTheme}
        onClearHistory={onClearHistory}
      />
    </>
  );
};

export default Sidebar;