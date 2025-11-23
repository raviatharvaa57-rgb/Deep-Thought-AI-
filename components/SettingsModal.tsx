
import React, { useState, useEffect } from 'react';
import { Theme, Language } from '../types';
import { XIcon, SunIcon, MoonIcon, SystemIcon, TrashIcon } from '../constants';
import { useLanguage } from './LanguageProvider';
import { LANGUAGES } from '../services/i18n';
import * as memoryService from '../services/memoryService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    theme: Theme;
    setTheme: (theme: Theme) => void;
    onClearHistory: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, theme, setTheme, onClearHistory }) => {
    const { language, setLanguage, t } = useLanguage();
    const [memories, setMemories] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMemories(memoryService.getMemories());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setLanguage(e.target.value as Language);
    };

    const handleClearClick = () => {
        if (window.confirm(t('settings.data.clearHistory.confirm'))) {
            onClearHistory();
            onClose();
        }
    };

    const handleDeleteMemory = (index: number) => {
        memoryService.deleteMemory(index);
        setMemories(memoryService.getMemories());
    };

    const themeOptions: { name: Theme; icon: React.FC<any>; label: string }[] = [
        { name: 'light', icon: SunIcon, label: t('settings.theme.light') },
        { name: 'dark', icon: MoonIcon, label: t('settings.theme.dark') },
        { name: 'system', icon: SystemIcon, label: t('settings.theme.system') },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-light-bg dark:bg-dark-sidebar rounded-lg shadow-xl w-full max-w-lg p-6 relative border border-light-border dark:border-dark-border max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-light-secondary-text dark:text-dark-secondary-text hover:text-light-text dark:hover:text-dark-text">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold mb-6 text-light-text dark:text-dark-text">{t('settings.title')}</h2>
                
                <div className="space-y-8">
                    {/* Appearance Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-light-text dark:text-dark-text">{t('settings.appearance')}</h3>
                        <div className="flex space-x-2 rounded-lg bg-light-input dark:bg-dark-input p-1">
                            {themeOptions.map(option => (
                                <button
                                    key={option.name}
                                    onClick={() => setTheme(option.name)}
                                    className={`w-full flex justify-center items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        theme === option.name
                                            ? 'bg-light-bg dark:bg-dark-bg text-dark-accent shadow'
                                            : 'text-light-secondary-text dark:text-dark-secondary-text hover:bg-light-border dark:hover:bg-dark-border'
                                    }`}
                                >
                                    {React.createElement(option.icon, { className: 'w-5 h-5' })}
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Language Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-light-text dark:text-dark-text">{t('settings.language')}</h3>
                        <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text mb-2">
                            {t('settings.language.description')}
                        </p>
                        <select
                            value={language}
                            onChange={handleLanguageChange}
                            className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
                        >
                            {LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>

                     {/* AI Memory Section */}
                     <div>
                        <h3 className="text-lg font-semibold mb-3 text-light-text dark:text-dark-text">AI Memory</h3>
                        <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text mb-3">
                            The AI can remember facts about you to personalize your experience.
                        </p>
                        <div className="bg-light-input dark:bg-dark-input rounded-lg border border-light-border dark:border-dark-border max-h-40 overflow-y-auto">
                            {memories.length > 0 ? (
                                <ul className="divide-y divide-light-border dark:divide-dark-border">
                                    {memories.map((fact, index) => (
                                        <li key={index} className="flex justify-between items-center p-3 text-sm text-light-text dark:text-dark-text">
                                            <span>{fact}</span>
                                            <button 
                                                onClick={() => handleDeleteMemory(index)} 
                                                className="text-light-secondary-text dark:text-dark-secondary-text hover:text-red-500 dark:hover:text-red-400"
                                                title="Delete memory"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-4 text-center text-sm text-light-secondary-text dark:text-dark-secondary-text italic">
                                    No memories saved yet. Tell the AI about yourself!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Data Management Section */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-light-text dark:text-dark-text">{t('settings.dataManagement')}</h3>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-light-border dark:border-dark-border">
                            <div>
                                <h4 className="font-medium text-light-text dark:text-dark-text">{t('settings.data.clearHistory')}</h4>
                                <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text">
                                    {t('settings.data.clearHistory.description')}
                                </p>
                            </div>
                            <button
                                onClick={handleClearClick}
                                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors text-sm"
                            >
                                {t('settings.data.clearHistory.button')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-dark-accent text-white font-semibold rounded-lg shadow-md hover:bg-dark-accent-hover transition-colors">
                        {t('settings.done')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
