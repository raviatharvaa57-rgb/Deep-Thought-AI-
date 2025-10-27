
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Language } from '../types';
import { getTranslator, LANGUAGES } from '../services/i18n';

interface LanguageContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>('en');

    useEffect(() => {
        const storedLang = localStorage.getItem('language') as Language | null;
        if (storedLang && LANGUAGES.some(l => l.code === storedLang)) {
            setLanguageState(storedLang);
        } else {
            // Auto-detect browser language
            const browserLang = navigator.language.split('-')[0] as Language;
            if (LANGUAGES.some(l => l.code === browserLang)) {
                setLanguageState(browserLang);
            } else {
                setLanguageState('en'); // Default
            }
        }
    }, []);

    const setLanguage = useCallback((newLanguage: Language) => {
        setLanguageState(newLanguage);
        localStorage.setItem('language', newLanguage);
    }, []);

    const t = useMemo(() => getTranslator(language), [language]);

    const value = { language, setLanguage, t };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
