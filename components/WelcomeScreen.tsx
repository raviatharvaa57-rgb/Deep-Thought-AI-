
import React, { useState } from 'react';
import { PelicanIcon } from '../constants';
import { User } from '../types';
import * as authService from '../services/authService';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  onGuest: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onGuest }) => {
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900">
      <div className="text-center p-8 max-w-md mx-auto w-full">
        <div className="inline-block p-4 bg-white dark:bg-gray-700 rounded-full shadow-lg mb-6">
           <PelicanIcon className="w-16 h-16 text-indigo-500 dark:text-indigo-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-white mb-2">Deep Thought AI</h1>
        <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
          {isLoginView ? 'Welcome back!' : 'Create your account.'}
        </p>
        
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <div className="flex justify-center mb-6 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => { setIsLoginView(true); setError(null); }} className={`px-6 py-2 text-lg font-medium ${isLoginView ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Login</button>
            <button onClick={() => { setIsLoginView(false); setError(null); }} className={`px-6 py-2 text-lg font-medium ${!isLoginView ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Sign Up</button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginView && (
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button 
              type="submit"
              className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-700 transition-transform transform hover:scale-105 mt-4"
            >
              {isLoginView ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <button 
            onClick={onGuest}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            or Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
