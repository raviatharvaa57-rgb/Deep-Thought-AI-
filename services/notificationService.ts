import { Notification } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'deep-thought-ai-seen-notifications';

// Static list of notifications. New updates can be added here.
const ALL_NOTIFICATIONS: Notification[] = [
    {
        id: 'update-2025-04-23-code-agent',
        title: 'New Feature: Code Agent!',
        message: 'Introducing the Code Agent, powered by gemini-2.5-pro. Get expert help with building apps, debugging, and all your coding tasks. Try it with the /code command!',
        timestamp: new Date('2025-04-23T10:00:00Z').getTime(),
    },
    {
        id: 'update-2025-04-20-live-mode',
        title: 'Live Conversation Mode is Here',
        message: 'You can now have real-time, spoken conversations with Deep Thought AI. Click the "Live Talk" feature in the sidebar to start.',
        timestamp: new Date('2025-04-20T14:30:00Z').getTime(),
    },
    {
        id: 'update-2025-04-18-image-editing',
        title: 'Image Editing and Analysis',
        message: 'You can now upload images to edit them with text prompts or ask questions about their content. Just attach an image to get started.',
        timestamp: new Date('2025-04-18T09:00:00Z').getTime(),
    }
];

const getSeenNotificationIds = (): string[] => {
    try {
        const seenJson = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        return seenJson ? JSON.parse(seenJson) : [];
    } catch (e) {
        console.error('Failed to parse seen notifications:', e);
        return [];
    }
};

export const getNotifications = (): Notification[] => {
    // Return sorted by most recent first
    return [...ALL_NOTIFICATIONS].sort((a, b) => b.timestamp - a.timestamp);
};

export const getUnreadCount = (): number => {
    const seenIds = getSeenNotificationIds();
    const unreadNotifications = ALL_NOTIFICATIONS.filter(n => !seenIds.includes(n.id));
    return unreadNotifications.length;
};

export const markAllAsRead = () => {
    const allIds = ALL_NOTIFICATIONS.map(n => n.id);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(allIds));
};
