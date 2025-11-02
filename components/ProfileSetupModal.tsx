
import React, { useState, useRef } from 'react';
import { User } from '../types';
import * as authService from '../services/authService';
import { CameraIcon } from '../constants';
import { useLanguage } from './LanguageProvider';

interface ProfileSetupModalProps {
    user: User;
    onUpdateUser: (user: User) => void;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ user, onUpdateUser }) => {
    const { t } = useLanguage();
    const [firstName, setFirstName] = useState(user.firstName);
    const [lastName, setLastName] = useState(user.lastName);
    const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAvatar = () => {
        setNewAvatarPreview(authService.generateAvatar(firstName, lastName));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalAvatar: string;
        if (newAvatarPreview) {
            finalAvatar = newAvatarPreview;
        } else {
            const wasGenerated = user.avatar.startsWith('data:image/svg+xml');
            const nameChanged = user.firstName !== firstName || user.lastName !== lastName;
            if (wasGenerated && nameChanged) {
                finalAvatar = authService.generateAvatar(firstName, lastName);
            } else {
                finalAvatar = user.avatar;
            }
        }

        onUpdateUser({ ...user, firstName, lastName, avatar: finalAvatar, isNewUser: false });
    };

    const currentAvatar = newAvatarPreview || user.avatar;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-light-bg dark:bg-dark-sidebar rounded-lg shadow-xl w-full max-w-md p-6 border border-light-border dark:border-dark-border">
                <h2 className="text-2xl font-bold mb-2 text-center text-light-text dark:text-dark-text">{t('profileSetup.title')}</h2>
                <p className="text-center text-light-secondary-text dark:text-dark-secondary-text mb-6">{t('profileSetup.subtitle')}</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col items-center mb-6">
                        <div className="relative">
                            <img src={currentAvatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover ring-2 ring-offset-2 ring-offset-light-bg dark:ring-offset-dark-sidebar ring-dark-accent" />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-dark-accent text-white rounded-full p-2 hover:bg-dark-accent-hover transition-transform transform hover:scale-110" aria-label="Change avatar">
                                <CameraIcon className="w-5 h-5" />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                        </div>
                        <button type="button" onClick={handleRemoveAvatar} className="mt-3 text-sm text-dark-accent hover:underline">
                            {t('profile.removePhoto')}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label htmlFor="firstName" className="block text-sm font-medium text-light-secondary-text dark:text-dark-secondary-text mb-1">{t('firstName')}</label>
                                <input
                                  id="firstName"
                                  type="text"
                                  value={firstName}
                                  onChange={(e) => setFirstName(e.target.value)}
                                  placeholder={t('firstName')}
                                  required
                                  className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
                                />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="lastName" className="block text-sm font-medium text-light-secondary-text dark:text-dark-secondary-text mb-1">{t('lastName')}</label>
                                <input
                                  id="lastName"
                                  type="text"
                                  value={lastName}
                                  onChange={(e) => setLastName(e.target.value)}
                                  placeholder={t('lastName')}
                                  required
                                  className="w-full px-4 py-2 border border-light-border dark:border-dark-border rounded-md focus:outline-none focus:ring-2 focus:ring-dark-accent bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end">
                        <button type="submit" className="w-full px-6 py-3 bg-dark-accent text-white font-semibold rounded-lg shadow-md hover:bg-dark-accent-hover transition-colors">
                            {t('profileSetup.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetupModal;