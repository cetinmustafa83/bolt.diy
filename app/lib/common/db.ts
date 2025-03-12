import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface PromptDBSchema extends DBSchema {
  prompts: {
    key: string;
    value: {
      id: string;
      label: string;
      description: string;
      content: string;
      category: string;
      isSystem?: boolean;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: { 'by-category': string };
  };
  categories: {
    key: string;
    value: {
      name: string;
      type: 'system' | 'custom';
      createdAt: Date;
    };
  };
}

class PromptDB {
  private db: IDBPDatabase<PromptDBSchema> | null = null;
  private static instance: PromptDB;

  private constructor() {}

  static getInstance(): PromptDB {
    if (!PromptDB.instance) {
      PromptDB.instance = new PromptDB();
    }
    return PromptDB.instance;
  }

  async connect(): Promise<void> {
    if (!this.db) {
      this.db = await openDB<PromptDBSchema>('promptDB', 1, {
        upgrade(db) {
          // Prompts store
          const promptStore = db.createObjectStore('prompts', { keyPath: 'id' });
          promptStore.createIndex('by-category', 'category');

          // Categories store
          db.createObjectStore('categories', { keyPath: 'name' });
        },
      });
    }
  }

  async addPrompt(prompt: Omit<PromptDBSchema['prompts']['value'], 'createdAt' | 'updatedAt'>): Promise<string> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    const now = new Date();
    const promptWithDates = {
      ...prompt,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.put('prompts', promptWithDates);
    return prompt.id;
  }

  async getPrompt(id: string): Promise<PromptDBSchema['prompts']['value'] | undefined> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    return await this.db.get('prompts', id);
  }

  async getAllPrompts(): Promise<PromptDBSchema['prompts']['value'][]> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    return await this.db.getAll('prompts');
  }

  async updatePrompt(id: string, updates: Partial<PromptDBSchema['prompts']['value']>): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    const prompt = await this.db.get('prompts', id);
    if (!prompt) throw new Error('Prompt not found');

    await this.db.put('prompts', {
      ...prompt,
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deletePrompt(id: string): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.delete('prompts', id);
  }

  async setPromptStatus(id: string, isActive: boolean): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    const prompt = await this.db.get('prompts', id);
    if (!prompt) throw new Error('Prompt not found');

    await this.db.put('prompts', {
      ...prompt,
      isActive,
      updatedAt: new Date(),
    });
  }

  async addCategory(name: string, type: 'system' | 'custom' = 'custom'): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    await this.db.put('categories', {
      name,
      type,
      createdAt: new Date(),
    });
  }

  async getAllCategories(): Promise<PromptDBSchema['categories']['value'][]> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    return await this.db.getAll('categories');
  }

  async deleteCategory(name: string): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    await this.db.delete('categories', name);
  }

  async getPromptsByCategory(category: string): Promise<PromptDBSchema['prompts']['value'][]> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    return await this.db.getAllFromIndex('prompts', 'by-category', category);
  }
}

export const promptDB = PromptDB.getInstance(); 