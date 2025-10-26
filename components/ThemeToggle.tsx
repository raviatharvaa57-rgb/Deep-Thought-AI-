
import React from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon, SystemIcon } from '../constants';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const themes: { name: Theme, icon: React.FC<any> }[] = [
    { name: 'light', icon: SunIcon },
    { name: 'dark', icon: MoonIcon },
    { name: 'system', icon: SystemIcon },
  ];

  const cycleTheme = () => {
    const currentIndex = themes.findIndex(t => t.name === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].name);
  };
  
  const currentTheme = themes.find(t => t.name === theme) || themes[2];

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-full bg-light-input dark:bg-dark-input hover:bg-light-border dark:hover:bg-dark-border transition-colors"
      aria-label={`Switch to ${themes[(themes.findIndex(t => t.name === theme) + 1) % themes.length].name} mode`}
    >
      {React.createElement(currentTheme.icon, {className: "w-6 h-6"})}
    </button>
  );
};

export default ThemeToggle;
