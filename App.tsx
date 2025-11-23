import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/WelcomeScreen';
import { Theme, User } from './types';
import * as authService from './services/authService';
import { generateAvatar } from './services/authService';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('system');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Consolidated auth check logic
  const checkUserSession = useCallback(async () => {
    try {
        const currentUser = await authService.getSessionUser();
        setUser(currentUser);
    } catch (e) {
        console.error("Session check failed", e);
    } finally {
        setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUserSession();
  }, [checkUserSession]);
  
  const handleLoginSuccess = useCallback(() => {
    checkUserSession();
  }, [checkUserSession]);

  useEffect(() => {
    const applyTheme = () => {
      const storedTheme = localStorage.getItem('theme') as Theme | null;
      const effectiveTheme = storedTheme || 'system';
      setTheme(effectiveTheme);

      if (effectiveTheme === 'dark' || (effectiveTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, []);

  const handleSetTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
    if (newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
  }, []);

  const handleGuest = () => {
    const firstName = 'Guest';
    const lastName = 'User';
    const guestUser: User = { 
      firstName, 
      lastName, 
      avatar: generateAvatar(firstName, lastName) 
    };
    sessionStorage.setItem('guestUser', JSON.stringify(guestUser));
    setUser(guestUser);
  }

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };
  
  const handleUpdateUser = async (updatedUser: User) => {
    await authService.updateUserProfile(updatedUser);
    // Refresh local state immediately for responsiveness
    setUser(updatedUser);
  };
  
  if (authLoading) {
      return <div className="flex items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
          <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 bg-dark-accent rounded-full mb-4"></div>
              <div className="h-4 w-32 bg-light-border dark:bg-dark-border rounded"></div>
          </div>
      </div>;
  }

  if (!user) {
    return <AuthScreen onGuest={handleGuest} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="bg-light-bg dark:bg-dark-bg min-h-screen text-light-text dark:text-dark-text font-sans transition-colors duration-300">
      <Dashboard user={user} theme={theme} setTheme={handleSetTheme} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
    </div>
  );
};

export default App;