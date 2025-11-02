import React from 'react';
import { useLanguage } from './LanguageProvider';
import { GrokIcon } from '../constants';

const HelpGuide: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-16 h-16 mb-4 flex items-center justify-center rounded-full bg-dark-accent">
        <GrokIcon className="w-9 h-9 text-white" />
      </div>
      <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">{t('help.title')}</h1>
      <p className="mt-2 text-lg text-light-secondary-text dark:text-dark-secondary-text mb-10 max-w-2xl">
        {t('help.subtitle')}
      </p>
    </div>
  );
};

export default HelpGuide;