import React from 'react';
import { User } from '../types';
import { useLanguage } from './LanguageProvider';
import { LightbulbIcon } from '../constants';

interface WelcomeGuideProps {
  user: User;
  onExampleClick: (example: string) => void;
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ user, onExampleClick }) => {
  const { t } = useLanguage();

  const examples = [
    t('help.examples.1'),
    t('help.examples.2'),
    t('help.examples.3'),
  ];
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <img src={user.avatar} alt="User Avatar" className="w-20 h-20 rounded-full mb-4 ring-2 ring-offset-2 ring-offset-light-bg dark:ring-offset-dark-bg ring-dark-accent" />
      <h1 className="text-3xl font-bold text-light-text dark:text-dark-text mb-2">
        {user.isNewUser
            ? t('welcome.newUser', { name: user.firstName })
            : t('welcome.back', { name: user.firstName })}
      </h1>
      
      {user.isAdmin && user.email && (
        <div className="flex items-center justify-center gap-2 mb-4 animate-fade-in">
             <span className="text-sm font-medium text-light-secondary-text dark:text-dark-secondary-text bg-light-input dark:bg-dark-input px-3 py-1 rounded-full border border-light-border dark:border-dark-border">
                {user.email}
             </span>
             <span className="px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-full shadow-md">
                ADMIN
             </span>
        </div>
      )}

      <p className="text-lg text-light-secondary-text dark:text-dark-secondary-text mb-10">
        {t('welcome.greeting')}
      </p>
      
      <div className="w-full max-w-lg mx-auto">
        <div className="flex items-center justify-center text-center mb-4">
            <LightbulbIcon className="w-8 h-8 mr-3 text-light-text dark:text-dark-text" />
            <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">{t('help.examples.title')}</h2>
        </div>
        <div className="space-y-3">
          {examples.map((item, index) => 
            <button 
              key={index}
              onClick={() => onExampleClick(item.replace(/“|”/g, ''))}
              className="w-full p-3 bg-light-input dark:bg-dark-input rounded-lg text-sm text-left hover:bg-light-border dark:hover:bg-dark-border transition-colors text-light-text dark:text-dark-text"
            >
              {item}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeGuide;