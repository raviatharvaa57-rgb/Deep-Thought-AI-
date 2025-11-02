import { User } from '../types';

const USERS_STORAGE_KEY = 'deep-thought-ai-users';

// NOTE: This is a mock authentication service using localStorage.
// In a real application, this would be handled by a secure backend server.
// Storing passwords in localStorage is not secure.

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

/**
 * Generates a data URI for an SVG avatar with the user's initials and a unique color.
 * @param firstName The user's first name.
 * @param lastName The user's last name.
 * @returns A base64 encoded SVG data URI.
 */
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
      hash = hash & hash; // Convert to 32bit integer
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


const getUsers = (): (User & { password: string })[] => {
  const usersJson = localStorage.getItem(USERS_STORAGE_KEY);
  return usersJson ? JSON.parse(usersJson) : [];
};

const saveUsers = (users: (User & { password: string })[]) => {
  // Fix: Corrected typo in constant name.
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const signup = async (firstName: string, lastName: string, email: string, password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => { // Simulate network delay
      if (!firstName || !lastName || !email || !password) {
        return reject(new Error('First name, last name, email, and password are required.'));
      }

      const users = getUsers();
      if (users.some(user => user.email === email)) {
        return reject(new Error('User with this email already exists.'));
      }

      const newUser: User & { password: string } = {
        firstName,
        lastName,
        email,
        password, // In a real app, this should be hashed
        avatar: generateAvatar(firstName, lastName),
        isNewUser: true,
      };

      users.push(newUser);
      saveUsers(users);
      
      const { password: _, ...userToReturn } = newUser;
      resolve(userToReturn);
    }, 500);
  });
};

export const login = async (email: string, password: string): Promise<User> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => { // Simulate network delay
      const users = getUsers();
      const user = users.find(u => u.email === email);

      if (!user) {
        return reject(new Error('Invalid email or password.'));
      }

      // In a real app, you would use a secure method to compare hashed passwords
      if (user.password !== password) {
        return reject(new Error('Invalid email or password.'));
      }
      
      const { password: _, ...userFromDb } = user;

      // Explicitly handle the isNewUser flag for robustness.
      // If a user has the flag set to true, they need to complete onboarding.
      // Otherwise (false or undefined for legacy users), they are a returning user.
      const userToReturn: User = {
        ...userFromDb,
        isNewUser: user.isNewUser === true
      };
      
      resolve(userToReturn);
    }, 500);
  });
};

export const updateUserInStorage = (updatedUser: User) => {
    if (!updatedUser.email) return; // Only for registered users with an email
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === updatedUser.email);
    if (userIndex !== -1) {
        const originalPassword = users[userIndex].password;
        users[userIndex] = { ...updatedUser, password: originalPassword };
        saveUsers(users);
    }
};