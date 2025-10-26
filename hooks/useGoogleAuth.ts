
import { useState, useEffect, useRef, useCallback } from 'react';
import { User, DecodedJwt, CredentialResponse } from '../types';

// FIX: Add global type for Google Identity Services library to avoid TypeScript errors.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void; }) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          disableAutoSelect: () => void;
          prompt: () => void;
        }
      }
    }
  }
}

export const useGoogleAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isDevMode, setIsDevMode] = useState(false);
    const signInButtonRef = useRef<HTMLDivElement>(null);

    const decodeJwt = (token: string): DecodedJwt | null => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            console.error("Error decoding JWT", e);
            return null;
        }
    };
    
    const signIn = (loggedInUser: User) => {
        setUser(loggedInUser);
    };

    const signOut = () => {
        if (window.google) {
            window.google.accounts.id.disableAutoSelect();
        }
        setUser(null);
    };

    const handleCredentialResponse = useCallback((response: CredentialResponse) => {
        if (response.credential) {
            const decoded = decodeJwt(response.credential);
            if (decoded) {
                // FIX: Split the full name from Google into firstName and lastName to match the User type.
                const nameParts = decoded.name.split(' ');
                const firstName = nameParts.shift() || '';
                const lastName = nameParts.join(' ');
                // FIX: Correctly create a User object with firstName, lastName, avatar, and email.
                signIn({ firstName, lastName, avatar: decoded.picture, email: decoded.email });
            }
        }
    }, []);

    useEffect(() => {
        const clientId = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // <-- REPLACE WITH YOUR ACTUAL CLIENT ID

        if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
            console.warn("Google Client ID not found. Running in dev mode with a mock 'Sign in with Google' button.");
            setIsDevMode(true);
            return;
        }

        if (window.google && signInButtonRef.current) {
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: handleCredentialResponse,
            });

            window.google.accounts.id.renderButton(
                signInButtonRef.current,
                { theme: "outline", size: "large", type: 'standard', text: 'signin_with', width: '320' }
            );

            // This can be annoying during development, so you might want to comment it out.
            // It automatically prompts the user to sign in if they have a saved session.
            // window.google.accounts.id.prompt(); 
        }
    }, [handleCredentialResponse]);

    return { user, signIn, signOut, signInButtonRef, isDevMode };
};