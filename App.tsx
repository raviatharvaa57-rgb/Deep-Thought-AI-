
import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/WelcomeScreen'; // Renamed semantically, file is WelcomeScreen.tsx
import ProfileSetupModal from './components/ProfileSetupModal';
import { Theme, User } from './types';
import * as authService from './services/authService';
import { generateAvatar } from './services/authService';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('system');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const persistentUserJSON = localStorage.getItem('currentUser');

      if (persistentUserJSON && persistentUserJSON !== 'null') {
        // Found a persistent user, this is the priority.
        setUser(JSON.parse(persistentUserJSON));
        // Clean up any stray guest session data to prevent conflicts.
        sessionStorage.removeItem('guestUser');
        return;
      }

      // No persistent user, check for a temporary guest session.
      const guestUserJSON = sessionStorage.getItem('guestUser');
      if (guestUserJSON && guestUserJSON !== 'null') {
        setUser(JSON.parse(guestUserJSON));
      }
    } catch (error) {
      console.error("Failed to parse user session from storage:", error);
      // If parsing fails, clear everything to be safe.
      localStorage.removeItem('currentUser');
      sessionStorage.removeItem('guestUser');
      setUser(null); // Ensure state is also cleared
    }
  }, []);
  
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

  const handleLogin = (loggedInUser: User) => {
    // Persist registered user session and clear any guest session
    localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
    sessionStorage.removeItem('guestUser');
    setUser(loggedInUser);
  };

  const handleGuest = () => {
    const firstName = 'Guest';
    const lastName = 'User';
    const guestUser: User = { 
      firstName, 
      lastName, 
      avatar: generateAvatar(firstName, lastName) 
    };
    // Use temporary session for guests and clear any persistent login
    sessionStorage.setItem('guestUser', JSON.stringify(guestUser));
    localStorage.removeItem('currentUser');
    setUser(guestUser);
  }

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('guestUser');
  };
  
  const handleUpdateUser = (updatedUser: User) => {
    if (!user) return;

    setUser(updatedUser); // Update state immediately for responsiveness

    if (user.email) { // Registered user
        authService.updateUserInStorage(updatedUser);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    } else { // Guest user
        sessionStorage.setItem('guestUser', JSON.stringify(updatedUser));
    }
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} onGuest={handleGuest} />;
  }

  if (user.isNewUser && user.email) {
    return <ProfileSetupModal user={user} onUpdateUser={handleUpdateUser} />;
  }

  return (
    <div className="bg-light-bg dark:bg-dark-bg min-h-screen text-light-text dark:text-dark-text font-sans">
      <Dashboard user={user} theme={theme} setTheme={handleSetTheme} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
    </div>
  );
};

export default App;
