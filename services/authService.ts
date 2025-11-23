
import { User } from '../types';

const USERS_KEY = 'deep_thought_users';
const SESSION_KEY = 'deep_thought_session';
const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

const ADMIN_EMAILS = ['raviatharvaa2@gmail.com', 'raviatharvaa67@gmail.com', 'raviatharvaa57@gmail.com'];

export const generateAvatar = (firstName: string, lastName: string): string => {
  const firstInitial = firstName ? firstName.charAt(0) : '';
  const lastInitial = lastName ? lastName.charAt(0) : '';
  const initials = `${firstInitial}${lastInitial}`.toUpperCase();
  const nameForHash = `${firstName} ${lastName}`.trim();
  let hash = 0;
  if (nameForHash.length > 0) {
    for (let i = 0; i < nameForHash.length; i++) {
      const char = nameForHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
  }
  const colorIndex = Math.abs(hash % COLORS.length);
  const color = COLORS[colorIndex];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <rect width="100%" height="100%" fill="${color}" />
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-size="60" font-weight="bold" fill="#ffffff">
        ${initials}
      </text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));

  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  
  if (users.some((u: any) => u.email === email)) {
    return { data: null, error: { message: 'User already exists' } };
  }

  const avatar = generateAvatar(firstName, lastName);
  const isAdmin = ADMIN_EMAILS.includes(email);
  const newUser = { email, password, firstName, lastName, avatar, isAdmin };
  
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Auto-login after signup
  const sessionUser: User = { firstName, lastName, avatar, email, isNewUser: true, isAdmin };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

  return { data: { user: newUser, session: true }, error: null };
};

export const signIn = async (email: string, password: string) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));

  let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const user = users.find((u: any) => u.email === email);

  if (user) {
    if (user.password === password) {
         const sessionUser: User = { 
            firstName: user.firstName, 
            lastName: user.lastName, 
            avatar: user.avatar, 
            email: user.email,
            isNewUser: false,
            isAdmin: user.isAdmin
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
          return { data: { user: sessionUser, session: true }, error: null };
    } else {
        return { data: null, error: { message: 'Incorrect password' } };
    }
  }

  // Fallback & Admin Auto-Registration
  // If the user database is empty OR if the email is a designated Admin email,
  // automatically create the account to prevent "Account not found".
  const isAdminEmail = ADMIN_EMAILS.includes(email);
  
  if (users.length === 0 || isAdminEmail) {
      const nameParts = email.split('@')[0].split(/[._]/);
      const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'User';
      const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : (isAdminEmail ? 'Admin' : 'User');
      
      const avatar = generateAvatar(firstName, lastName);
      const newUser = { email, password, firstName, lastName, avatar, isAdmin: isAdminEmail };
      users.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const sessionUser: User = { firstName, lastName, avatar, email, isNewUser: true, isAdmin: isAdminEmail };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      
      return { data: { user: sessionUser, session: true }, error: null };
  }

  return { data: null, error: { message: 'Account not found. Please Sign Up first.' } };
};

export const logout = async () => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('guestUser');
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 300));
};

export const getSessionUser = async (): Promise<User | null> => {
    // 1. Check Local Mock Session
    try {
        const sessionJson = localStorage.getItem(SESSION_KEY);
        if (sessionJson) {
            return JSON.parse(sessionJson);
        }
    } catch (error) {
        console.error("Error checking session:", error);
    }
    
    // 2. Check Guest Session
    try {
        const guestUserJSON = sessionStorage.getItem('guestUser');
        if (guestUserJSON) {
            return JSON.parse(guestUserJSON);
        }
    } catch (e) {
        console.error("Error parsing guest user", e);
    }

    return null;
};

export const updateUserProfile = async (user: User) => {
    // If guest (no email), update session storage
    if (!user.email) {
        sessionStorage.setItem('guestUser', JSON.stringify(user));
        return;
    }

    // Update active session
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    // Update persistent database
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const index = users.findIndex((u: any) => u.email === user.email);
    if (index !== -1) {
        users[index] = { 
            ...users[index], 
            firstName: user.firstName, 
            lastName: user.lastName, 
            avatar: user.avatar,
            isAdmin: user.isAdmin
        };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
};
