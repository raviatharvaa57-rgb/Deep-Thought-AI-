import React, { useState } from 'react';
import { GrokIcon } from '../constants';
import { useLanguage } from './LanguageProvider';
import * as authService from '../services/authService';

interface AuthScreenProps {
  onGuest: () => void;
  onLoginSuccess: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onGuest, onLoginSuccess }) => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await authService.signIn(email, password);
        if (error) throw new Error(error.message);
      } else {
        if (!firstName || !lastName) {
          throw new Error("First name and last name are required.");
        }
        const { error } = await authService.signUp(email, password, firstName, lastName);
        if (error) throw new Error(error.message);
      }
      // Notify parent to refresh session
      onLoginSuccess();
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "An error occurred during authentication.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text p-6 transition-colors duration-300">
      <div className="w-full max-w-md bg-light-sidebar dark:bg-dark-sidebar p-8 rounded-3xl shadow-2xl border border-light-border dark:border-dark-border">
        <div className="flex justify-center mb-8">
           <div className="p-4 rounded-full bg-dark-bg dark:bg-light-bg bg-opacity-5 dark:bg-opacity-5 ring-1 ring-light-border dark:ring-dark-border">
             <GrokIcon className="w-14 h-14 text-light-text dark:text-dark-text" />
           </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-center mb-2 tracking-tight">{t('welcome.title')}</h1>
        <p className="text-center text-light-secondary-text dark:text-dark-secondary-text mb-8 text-sm">
          {isLogin ? t('welcome.subtitle.login') : t('welcome.subtitle.signup')}
        </p>

        {successMessage ? (
           <div className="p-4 rounded-xl bg-green-500 bg-opacity-10 text-green-600 dark:text-green-400 text-center mb-6 border border-green-500/20">
             {successMessage}
             <button onClick={() => { setIsLogin(true); setSuccessMessage(null); }} className="block w-full mt-4 text-sm font-bold underline">Go to Login</button>
           </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
                <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-light-secondary-text dark:text-dark-secondary-text">{t('firstName')}</label>
                    <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-light-input dark:bg-dark-input border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-dark-accent transition-all"
                    required
                    placeholder="Jane"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-light-secondary-text dark:text-dark-secondary-text">{t('lastName')}</label>
                    <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-light-input dark:bg-dark-input border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-dark-accent transition-all"
                    required
                    placeholder="Doe"
                    />
                </div>
                </div>
            )}

            <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-light-secondary-text dark:text-dark-secondary-text">{t('email')}</label>
                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-light-input dark:bg-dark-input border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-dark-accent transition-all"
                required
                placeholder="you@example.com"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5 text-light-secondary-text dark:text-dark-secondary-text">{t('password')}</label>
                <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-light-input dark:bg-dark-input border border-light-border dark:border-dark-border focus:outline-none focus:ring-2 focus:ring-dark-accent transition-all"
                required
                minLength={6}
                placeholder="••••••••"
                />
            </div>

            {error && (
                <div className="p-3 rounded-xl bg-red-500 bg-opacity-10 text-red-600 dark:text-red-400 text-sm text-center border border-red-500/20">
                {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-dark-accent text-white font-bold hover:bg-dark-accent-hover transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-dark-accent/20"
            >
                {loading ? 'Processing...' : (isLogin ? t('login') : t('createAccount'))}
            </button>
            </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); setSuccessMessage(null); }}
            className="text-sm font-medium text-dark-accent hover:text-dark-accent-hover transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-light-border dark:border-dark-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-light-sidebar dark:bg-dark-sidebar text-light-secondary-text dark:text-dark-secondary-text font-medium">Or</span>
          </div>
        </div>
        
        <button 
          onClick={onGuest}
          className="w-full py-3 rounded-xl border-2 border-light-border dark:border-dark-border font-bold text-light-secondary-text dark:text-dark-secondary-text hover:border-dark-accent hover:text-dark-accent transition-all"
        >
          {t('continueAsGuest').replace('or ', '')}
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;