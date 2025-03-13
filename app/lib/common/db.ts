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
      isDefault?: boolean;
    };
  };
}

const DEFAULT_CATEGORIES = ['Development', 'Writing', 'Business', 'Education', 'Custom'];

export class DB {
  private static _instance: DB;
  private _db: IDBPDatabase<PromptDBSchema> | null = null;

  // Private constructor for singleton pattern - initialization is done in connect()
  private constructor() {
    // Initialization is done in connect() method
  }

  static getInstance(): DB {
    if (!DB._instance) {
      DB._instance = new DB();
    }

    return DB._instance;
  }

  async connect(): Promise<void> {
    if (!this._db) {
      this._db = await openDB<PromptDBSchema>('promptDB', 1, {
        upgrade(db) {
          // Prompts store
          const promptStore = db.createObjectStore('prompts', { keyPath: 'id' });
          promptStore.createIndex('by-category', 'category');

          // Categories store
          const categoryStore = db.createObjectStore('categories', { keyPath: 'name' });
          
          // Add default categories
          DEFAULT_CATEGORIES.forEach(name => {
            categoryStore.put({
              name,
              type: 'system',
              createdAt: new Date(),
              isDefault: true
            });
          });
        },
      });
    }
  }

  async addPrompt(prompt: Omit<PromptDBSchema['prompts']['value'], 'createdAt' | 'updatedAt'>): Promise<string> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    const now = new Date();
    const promptWithDates = {
      ...prompt,
      createdAt: now,
      updatedAt: now,
    };

    await this._db.put('prompts', promptWithDates);

    return prompt.id;
  }

  async getPrompt(id: string): Promise<PromptDBSchema['prompts']['value'] | undefined> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    return await this._db.get('prompts', id);
  }

  async getAllPrompts(): Promise<PromptDBSchema['prompts']['value'][]> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    return await this._db.getAll('prompts');
  }

  async updatePrompt(id: string, updates: Partial<PromptDBSchema['prompts']['value']>): Promise<void> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    const prompt = await this._db.get('prompts', id);

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    await this._db.put('prompts', {
      ...prompt,
      ...updates,
      updatedAt: new Date(),
    });
  }

  async deletePrompt(id: string): Promise<void> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    await this._db.delete('prompts', id);
  }

  async setPromptStatus(id: string, isActive: boolean): Promise<void> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    const prompt = await this._db.get('prompts', id);

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    await this._db.put('prompts', {
      ...prompt,
      isActive,
      updatedAt: new Date(),
    });
  }

  async addCategory(name: string, type: 'system' | 'custom' = 'custom'): Promise<void> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    await this._db.put('categories', {
      name,
      type,
      createdAt: new Date(),
    });
  }

  async getAllCategories(): Promise<PromptDBSchema['categories']['value'][]> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    return await this._db.getAll('categories');
  }

  async deleteCategory(name: string): Promise<void> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    await this._db.delete('categories', name);
  }

  async getPromptsByCategory(category: string): Promise<PromptDBSchema['prompts']['value'][]> {
    await this.connect();

    if (!this._db) {
      throw new Error('Database not connected');
    }

    return await this._db.getAllFromIndex('prompts', 'by-category', category);
  }
}

export const promptDB = DB.getInstance();
