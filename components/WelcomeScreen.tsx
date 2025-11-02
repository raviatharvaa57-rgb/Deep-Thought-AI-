
import React, { useState } from 'react';
import { GrokIcon } from '../constants';
import { User } from '../types';
import * as authService from '../services/authService';
import { useLanguage } from './LanguageProvider';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  onGuest: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onGuest }) => {
  const { t } = useLanguage();
  const [isLoginView, setIsLoginView] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      let user: User;
      if (isLoginView) {
        user = await authService.login(email, password);
      } else {
        user = await authService.signup(firstName, lastName, email, password);
      }
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
      <div className="text-center p-8 max-w-md mx-auto w-full">
        <div className="inline-block p-4 rounded-full mb-6">
           <GrokIcon className="w-16 h-16 text-light-text dark:text-dark-text" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-light-text dark:text-dark-text mb-2">{t('welcome.title')}</h1>
        <p className="text-light-secondary-text dark:text-dark-secondary-text text-lg mb-8">
          {isLoginView ? t('welcome.subtitle.login') : t('welcome.subtitle.signup')}
        </p>
        
        <div className="bg-light-sidebar dark:bg-dark-sidebar shadow-xl rounded-lg p-8">
          <div className="flex justify-center mb-6 border-b border-light-border dark:border-dark-border">
            <button onClick={() => { setIsLoginView(true); setError(null); }} className={`px-6 py-2 text-lg font-medium ${isLoginView ? 'border-b-2 border-dark-accent text-dark-accent' : 'text-light-secondary-text dark:text-dark-secondary-text'}`}>{t('login')}</button>
            <button onClick={() => { setIsLoginView(false); setError(null); }} className={`px-6 py-2 text-lg font-medium ${!isLoginView ? 'border-b-2 border-dark-accent text-dark-accent' : 'text-light-secondary-text dark:text-dark-secondary-text'}`}>{t('signup')}</button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginView && (
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('firstName')}
                  required
                  className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('lastName')}
                  required
                  className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
                />
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email')}
              required
              className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('password')}
              required
              className="w-full px-4 py-3 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button 
              type="submit"
              className="w-full px-6 py-3 bg-dark-accent text-white font-semibold rounded-lg shadow-lg hover:bg-dark-accent-hover transition-transform transform hover:scale-105 mt-4"
            >
              {isLoginView ? t('login') : t('createAccount')}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <button 
            onClick={onGuest}
            className="text-dark-accent hover:underline"
          >
            {t('continueAsGuest')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;