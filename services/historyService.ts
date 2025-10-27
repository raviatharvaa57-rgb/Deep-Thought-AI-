
import { User, ChatHistoryItem, Message } from '../types';

const getStorage = (user: User | null): Storage => {
  // Guests don't have an email property, their history is session-based.
  // Registered users have persistent history in localStorage.
  return user && user.email ? localStorage : sessionStorage;
};

const getHistoryKey = (user: User | null) => {
    return user?.email ? `history_${user.email}` : 'history_guest';
}

const getChatKey = (chatId: string) => `chat_${chatId}`;

export const getHistory = (user: User | null): ChatHistoryItem[] => {
  try {
    const storage = getStorage(user);
    const historyJson = storage.getItem(getHistoryKey(user));
    const history = historyJson ? JSON.parse(historyJson) : [];
    // Sort by timestamp descending to show recent chats first
    return history.sort((a: ChatHistoryItem, b: ChatHistoryItem) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to parse history from storage:", error);
    return [];
  }
};

export const saveHistory = (user: User | null, history: ChatHistoryItem[]) => {
  const storage = getStorage(user);
  storage.setItem(getHistoryKey(user), JSON.stringify(history));
};

export const getChatMessages = (chatId: string, user: User | null): Message[] => {
  try {
    const storage = getStorage(user);
    const messagesJson = storage.getItem(getChatKey(chatId));
    return messagesJson ? JSON.parse(messagesJson) : [];
  } catch (error) {
    console.error(`Failed to parse messages for chat ${chatId}:`, error);
    return [];
  }
};

export const saveChatMessages = (chatId: string, messages: Message[], user: User | null) => {
  const storage = getStorage(user);
  storage.setItem(getChatKey(chatId), JSON.stringify(messages));
};

export const clearAllHistory = (user: User | null) => {
  const storage = getStorage(user);
  const history = getHistory(user); // Get all chat items

  // Remove individual chat message logs
  for (const chatItem of history) {
    storage.removeItem(getChatKey(chatItem.id));
  }

  // Remove the history list itself
  storage.removeItem(getHistoryKey(user));
};