import { ChatHistoryItem, Message } from '../types';

const getHistoryKey = () => 'history_guest';
const getChatKey = (chatId: string) => `chat_${chatId}`;

export const getHistory = (): ChatHistoryItem[] => {
  try {
    const historyJson = sessionStorage.getItem(getHistoryKey());
    const history = historyJson ? JSON.parse(historyJson) : [];
    return history.sort((a: ChatHistoryItem, b: ChatHistoryItem) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to parse guest history from storage:", error);
    return [];
  }
};

export const saveHistory = (history: ChatHistoryItem[]) => {
  sessionStorage.setItem(getHistoryKey(), JSON.stringify(history));
};

export const addOrUpdateChatHistory = (chatId: string, title: string) => {
    const history = getHistory();
    if (!history.some(item => item.id === chatId)) {
        const newHistoryItem: ChatHistoryItem = { id: chatId, title, timestamp: Date.now() };
        const updatedHistory = [newHistoryItem, ...history];
        saveHistory(updatedHistory);
    }
};

export const getChatMessages = (chatId: string): Message[] => {
  try {
    const messagesJson = sessionStorage.getItem(getChatKey(chatId));
    return messagesJson ? JSON.parse(messagesJson) : [];
  } catch (error) {
    console.error(`Failed to parse guest messages for chat ${chatId}:`, error);
    return [];
  }
};

export const saveChatMessages = (chatId: string, messages: Message[]) => {
  sessionStorage.setItem(getChatKey(chatId), JSON.stringify(messages));
};

export const saveMessage = (chatId: string, message: Message) => {
    const messages = getChatMessages(chatId);
    
    // Check if message with same id already exists to avoid duplicates from updates
    const existingIndex = messages.findIndex(m => m.id === message.id);
    if (existingIndex > -1) {
        messages[existingIndex] = message;
    } else {
        messages.push(message);
    }
    
    saveChatMessages(chatId, messages);
};


export const clearAllHistory = () => {
  const history = getHistory();
  for (const chatItem of history) {
    sessionStorage.removeItem(getChatKey(chatItem.id));
  }
  sessionStorage.removeItem(getHistoryKey());
};

export const deleteChat = (chatId: string): ChatHistoryItem[] => {
  let history = getHistory();
  const updatedHistory = history.filter(chat => chat.id !== chatId);
  sessionStorage.removeItem(getChatKey(chatId));
  saveHistory(updatedHistory);
  return updatedHistory;
};