
import React from 'react';
import { XIcon } from '../constants';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title">
            <div className="bg-light-bg dark:bg-dark-sidebar rounded-lg shadow-xl w-full max-w-md p-6 relative border border-light-border dark:border-dark-border" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-light-secondary-text dark:text-dark-secondary-text hover:text-light-text dark:hover:text-dark-text" aria-label="Close">
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 id="confirmation-dialog-title" className="text-xl font-bold mb-4 text-light-text dark:text-dark-text">{title}</h2>
                <p className="text-light-secondary-text dark:text-dark-secondary-text mb-8">{message}</p>
                
                <div className="flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-light-border dark:bg-dark-input hover:bg-dark-border text-light-text dark:text-dark-text font-semibold">
                        {cancelText || 'Cancel'}
                    </button>
                    <button type="button" onClick={onConfirm} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors">
                        {confirmText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;