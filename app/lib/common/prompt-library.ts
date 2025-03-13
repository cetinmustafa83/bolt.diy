import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { v4 as uuidv4 } from 'uuid';
import { promptDB } from './db';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
}

export interface CustomPrompt {
  id: string;
  label: string;
  description: string;
  content: string;
  category: string;
  isSystem?: boolean;
  isActive?: boolean;
}

export class PromptLibrary {
  private static readonly _systemPrompts: CustomPrompt[] = [];

  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
    }
  > = {
    default: {
      label: 'Default Prompt',
      description: 'This is the battle tested default system Prompt',
      get: (options) => getSystemPrompt(options.cwd),
    },
    optimized: {
      label: 'Optimized Prompt (experimental)',
      description: 'an Experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
    },
  };

  static getList(): CustomPrompt[] {
    return this._systemPrompts;
  }

  static async getCustomPrompts(): Promise<CustomPrompt[]> {
    try {
      const prompts = await promptDB.getAllPrompts();
      return prompts.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        content: p.content,
        category: p.category,
        isSystem: p.isSystem,
        isActive: p.isActive,
      }));
    } catch (err) {
      // Log the error for debugging but don't expose it
      console.error('Error getting prompts:', err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }

  static async getCategories(): Promise<string[]> {
    try {
      const categories = await promptDB.getAllCategories();
      return categories.map((c) => c.name).sort();
    } catch {
      console.error('Error getting categories');
      return [];
    }
  }

  static async addCustomPrompt(prompt: Omit<CustomPrompt, 'id'> & { id?: string }): Promise<CustomPrompt> {
    try {
      const newPrompt = {
        ...prompt,
        id: prompt.id || uuidv4(),
        isActive: false,
      };

      await promptDB.addPrompt(newPrompt);

      // Add category if it doesn't exist
      try {
        await promptDB.addCategory(prompt.category);
      } catch (_error) {
        // Category might already exist, ignore error
      }

      return newPrompt;
    } catch (_error) {
      console.error('Error adding prompt:', _error);
      throw _error;
    }
  }

  static async updateCustomPrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id'>>): Promise<void> {
    try {
      await promptDB.updatePrompt(id, updates);
    } catch (_error) {
      console.error('Error updating prompt:', _error);
      throw _error;
    }
  }

  static async deleteCustomPrompt(id: string): Promise<void> {
    try {
      await promptDB.deletePrompt(id);
    } catch (_error) {
      console.error('Error deleting prompt:', _error);
      throw _error;
    }
  }

  static async setPromptStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await promptDB.setPromptStatus(id, isActive);
    } catch (_error) {
      console.error('Error setting prompt status:', _error);
      throw _error;
    }
  }

  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Not Found';
    }

    return this.library[promptId]?.get(options);
  }
}
