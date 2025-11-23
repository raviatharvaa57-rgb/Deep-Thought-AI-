
const MEMORY_STORAGE_KEY = 'deep_thought_user_memory';

export const getMemories = (): string[] => {
  try {
    const memoryJson = localStorage.getItem(MEMORY_STORAGE_KEY);
    return memoryJson ? JSON.parse(memoryJson) : [];
  } catch (e) {
    console.error("Failed to parse memory", e);
    return [];
  }
};

export const addMemory = (fact: string) => {
  const memories = getMemories();
  // Prevent exact duplicates
  if (!memories.includes(fact)) {
    memories.push(fact);
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
  }
};

export const deleteMemory = (index: number) => {
  const memories = getMemories();
  if (index >= 0 && index < memories.length) {
    memories.splice(index, 1);
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
  }
};

export const clearMemories = () => {
  localStorage.removeItem(MEMORY_STORAGE_KEY);
};
