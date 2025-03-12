import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { v4 as uuidv4 } from 'uuid';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
}

// Rule özelliklerini tanımlayan arayüz
export interface Rule {
  id: string;
  label: string;
  description: string;
  content: string;
  category: string;
  priority: number; // Kuralın uygulama önceliği (daha yüksek sayı daha öncelikli)
  isEnabled: boolean;
  isSystem?: boolean;
  sourceUrl?: string;
  version?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Prompt özelliklerini tanımlayan arayüz
export interface Prompt {
  id: string;
  label: string;
  description: string;
  content: string;
  category: string;
  isSystem?: boolean;
  sourceUrl?: string;
  version?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Geriye dönük uyumluluk için CustomPrompt arayüzü
export interface CustomPrompt {
  id: string;
  label: string;
  description: string;
  content: string;
  category: string;
  isSystem?: boolean;
  sourceUrl?: string;
  isRule?: boolean;
  priority?: number;
  version?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Kategori tipi
export interface Category {
  id: string;
  name: string;
  description?: string;
  parent?: string; // Üst kategorinin ID'si (hiyerarşik kategoriler için)
}

// Koleksiyon tipi (farklı Prompt ve Rule kombinasyonları)
export interface Collection {
  id: string;
  name: string;
  description: string;
  promptIds: string[];
  ruleIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Veritabanını yönetecek servis sınıfı
class StorageService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'bolt_prompt_library';
  private readonly DB_VERSION = 1;
  private readonly STORES = {
    PROMPTS: 'prompts',
    RULES: 'rules',
    CATEGORIES: 'categories',
    COLLECTIONS: 'collections'
  };
  
  // Legacy localStorage anahtarı (public olarak dışarıdan erişilebilir)
  readonly LEGACY_STORAGE_KEY = 'bolt_custom_prompts';

  // IndexedDB bağlantısı başlatma
  async init(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not supported, falling back to localStorage');
        resolve(false);
        return;
      }

      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Stores oluşturma
        if (!db.objectStoreNames.contains(this.STORES.PROMPTS)) {
          db.createObjectStore(this.STORES.PROMPTS, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(this.STORES.RULES)) {
          db.createObjectStore(this.STORES.RULES, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(this.STORES.CATEGORIES)) {
          db.createObjectStore(this.STORES.CATEGORIES, { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains(this.STORES.COLLECTIONS)) {
          db.createObjectStore(this.STORES.COLLECTIONS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(true);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
        resolve(false);
      };
    });
  }

  // IndexedDB'den veri alma
  async getAll<T>(storeName: string): Promise<T[]> {
    // IndexedDB kullanılamıyorsa localStorage'dan al
    if (!this.db) {
      if (storeName === this.STORES.PROMPTS) {
        return this.getLegacyPrompts() as unknown as T[];
      }
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Veri ekleme
  async add<T extends { id: string }>(storeName: string, item: T): Promise<T> {
    // ID yoksa ekle
    if (!item.id) {
      item.id = uuidv4();
    }

    // IndexedDB kullanılamıyorsa localStorage'a ekle
    if (!this.db) {
      if (storeName === this.STORES.PROMPTS) {
        this.addLegacyPrompt(item as unknown as CustomPrompt);
      }
      return item;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => {
        resolve(item);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Veri güncelleme
  async update<T extends { id: string }>(storeName: string, item: T): Promise<T> {
    // IndexedDB kullanılamıyorsa localStorage'u güncelle
    if (!this.db) {
      if (storeName === this.STORES.PROMPTS) {
        this.updateLegacyPrompt(item.id, item as unknown as Partial<CustomPrompt>);
      }
      return item;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        resolve(item);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Veri silme
  async delete(storeName: string, id: string): Promise<boolean> {
    // IndexedDB kullanılamıyorsa localStorage'dan sil
    if (!this.db) {
      if (storeName === this.STORES.PROMPTS) {
        this.deleteLegacyPrompt(id);
      }
      return true;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ID ile veri alma
  async getById<T>(storeName: string, id: string): Promise<T | null> {
    // IndexedDB kullanılamıyorsa localStorage'dan al
    if (!this.db) {
      if (storeName === this.STORES.PROMPTS) {
        const items = this.getLegacyPrompts();
        const item = items.find(p => p.id === id);
        return item as unknown as T || null;
      }
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Legacy localStorage işlemleri (geriye dönük uyumluluk)
  private getLegacyPrompts(): CustomPrompt[] {
    const stored = localStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  private addLegacyPrompt(prompt: CustomPrompt): CustomPrompt {
    const customPrompts = this.getLegacyPrompts();
    customPrompts.push(prompt);
    
    localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(customPrompts));
    return prompt;
  }

  private updateLegacyPrompt(id: string, updates: Partial<CustomPrompt>): void {
    const customPrompts = this.getLegacyPrompts();
    const index = customPrompts.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error('Prompt not found');
    }

    customPrompts[index] = {
      ...customPrompts[index],
      ...updates
    };

    localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(customPrompts));
  }

  private deleteLegacyPrompt(id: string): void {
    const customPrompts = this.getLegacyPrompts();
    const filtered = customPrompts.filter(p => p.id !== id);
    
    if (filtered.length === customPrompts.length) {
      throw new Error('Prompt not found');
    }

    localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(filtered));
  }

  // Legacy verilerini yeni veritabanına aktarma
  async migrateLegacyData(): Promise<boolean> {
    if (!this.db) return false;

    try {
      const legacyPrompts = this.getLegacyPrompts();
      
      for (const item of legacyPrompts) {
        if (item.isRule) {
          // Rule olarak kaydet
          const rule: Rule = {
            id: item.id,
            label: item.label,
            description: item.description,
            content: item.content,
            category: item.category,
            priority: item.priority || 1,
            isEnabled: true,
            isSystem: item.isSystem,
            sourceUrl: item.sourceUrl,
            version: item.version || '1.0.0',
            tags: item.tags || [],
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
          };
          await this.add(this.STORES.RULES, rule);
        } else {
          // Prompt olarak kaydet
          const prompt: Prompt = {
            id: item.id,
            label: item.label,
            description: item.description,
            content: item.content,
            category: item.category,
            isSystem: item.isSystem,
            sourceUrl: item.sourceUrl,
            version: item.version || '1.0.0',
            tags: item.tags || [],
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString()
          };
          await this.add(this.STORES.PROMPTS, prompt);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Migration error:', error);
      return false;
    }
  }
}

export class PromptLibrary {
  private static readonly DEFAULT_CATEGORIES: string[] = [];
  private static readonly storageService = new StorageService();
  private static isInitialized = false;
  
  private static readonly SYSTEM_PROMPTS: CustomPrompt[] = [];

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

  // Veritabanını başlatma
  static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    const success = await this.storageService.init();
    
    if (success) {
      // Legacy verilerini taşı
      await this.storageService.migrateLegacyData();
      this.isInitialized = true;
    }
    
    return success;
  }

  // Sistem promptlarını döndürme
  static getList(): CustomPrompt[] {
    return this.SYSTEM_PROMPTS;
  }

  // Tüm özel promptları alma - Async
  static async getCustomPrompts(): Promise<CustomPrompt[]> {
    await this.ensureInitialized();
    
    try {
      const prompts = await this.storageService.getAll<Prompt>('prompts');
      return prompts.map(p => this.convertToCustomPrompt(p, false));
    } catch (error) {
      console.error('Error getting custom prompts:', error);
      return [];
    }
  }

  // Tüm özel promptları alma - Sync (geriye dönük uyumluluk)
  static getCustomPromptsSync(): CustomPrompt[] {
    // LocalStorage'dan eski yöntemle al
    try {
      const stored = localStorage.getItem(this.storageService.LEGACY_STORAGE_KEY);
      if (!stored) return [];
      
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  
  // Tüm kuralları alma
  static async getRules(): Promise<CustomPrompt[]> {
    await this.ensureInitialized();
    
    try {
      const rules = await this.storageService.getAll<Rule>('rules');
      return rules.map(r => this.convertToCustomPrompt(r, true));
    } catch (error) {
      console.error('Error getting rules:', error);
      return [];
    }
  }

  // Tüm kuralları alma - Sync (geriye dönük uyumluluk)
  static getRulesSync(): CustomPrompt[] {
    // LocalStorage'dan eski yöntemle al ve rule olanları filtrele
    try {
      const stored = localStorage.getItem(this.storageService.LEGACY_STORAGE_KEY);
      if (!stored) return [];
      
      const allItems = JSON.parse(stored);
      return allItems.filter((item: CustomPrompt) => 
        item.isRule || (item.label && item.label.includes('[Rule]'))
      );
    } catch {
      return [];
    }
  }

  // ID'ye göre prompt veya rule alma
  static async getById(id: string): Promise<CustomPrompt | null> {
    await this.ensureInitialized();
    
    try {
      // Önce prompt olarak ara
      let item = await this.storageService.getById<Prompt>('prompts', id);
      if (item) {
        return this.convertToCustomPrompt(item, false);
      }
      
      // Bulunamazsa rule olarak ara
      item = await this.storageService.getById<Rule>('rules', id);
      if (item) {
        return this.convertToCustomPrompt(item as unknown as Rule, true);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting item by ID:', error);
      return null;
    }
  }

  // ID'ye göre prompt veya rule alma - Sync (geriye dönük uyumluluk)
  static getByIdSync(id: string): CustomPrompt | null {
    try {
      const stored = localStorage.getItem(this.storageService.LEGACY_STORAGE_KEY);
      if (!stored) return null;
      
      const allItems = JSON.parse(stored);
      return allItems.find((item: CustomPrompt) => item.id === id) || null;
    } catch {
      return null;
    }
  }

  // Tüm kategorileri alma
  static async getCategories(): Promise<string[]> {
    await this.ensureInitialized();
    
    try {
      // IndexedDB'den kategorileri al
      const categories = await this.storageService.getAll<Category>('categories');
      const categoryNames = categories.map(c => c.name);
      
      // Prompts ve Rules içindeki kategorileri de topla
      const prompts = await this.getCustomPrompts();
      const rules = await this.getRules();
      
      const promptCategories = prompts.map(p => p.category);
      const ruleCategories = rules.map(r => r.category);
      const systemCategories = this.SYSTEM_PROMPTS.map(p => p.category);
      
      return [...new Set([
        ...this.DEFAULT_CATEGORIES,
        ...categoryNames,
        ...promptCategories,
        ...ruleCategories,
        ...systemCategories
      ])].sort();
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  // Tüm kategorileri alma - Sync (geriye dönük uyumluluk)
  static getCategoriesSync(): string[] {
    try {
      const customPrompts = this.getCustomPromptsSync();
      const customCategories = new Set(customPrompts.map(p => p.category));
      const systemCategories = new Set(this.SYSTEM_PROMPTS.map(p => p.category));
      
      return [...new Set([
        ...this.DEFAULT_CATEGORIES,
        ...customCategories,
        ...systemCategories
      ])].sort();
    } catch {
      return [];
    }
  }

  // Yeni bir kategori ekleme
  static async addCategory(name: string, description: string = ""): Promise<Category> {
    await this.ensureInitialized();
    
    const category: Category = {
      id: uuidv4(),
      name,
      description
    };
    
    try {
      return await this.storageService.add<Category>('categories', category);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  }

  // Özel bir prompt ekleme
  static async addCustomPrompt(promptData: Omit<CustomPrompt, 'id'>): Promise<CustomPrompt> {
    await this.ensureInitialized();
    
    const now = new Date().toISOString();
    const isRule = !!promptData.isRule || (promptData.label && promptData.label.includes('[Rule]'));
    
    try {
      if (isRule) {
        // Rule olarak ekle
        const rule: Rule = {
          id: uuidv4(),
          label: promptData.label,
          description: promptData.description,
          content: promptData.content,
          category: promptData.category,
          priority: promptData.priority || 1,
          isEnabled: true,
          isSystem: promptData.isSystem,
          sourceUrl: promptData.sourceUrl,
          version: promptData.version || '1.0.0',
          tags: promptData.tags || [],
          createdAt: now,
          updatedAt: now
        };
        
        const result = await this.storageService.add<Rule>('rules', rule);
        return this.convertToCustomPrompt(result, true);
      } else {
        // Prompt olarak ekle
        const prompt: Prompt = {
          id: uuidv4(),
          label: promptData.label,
          description: promptData.description,
          content: promptData.content,
          category: promptData.category,
          isSystem: promptData.isSystem,
          sourceUrl: promptData.sourceUrl,
          version: promptData.version || '1.0.0',
          tags: promptData.tags || [],
          createdAt: now,
          updatedAt: now
        };
        
        const result = await this.storageService.add<Prompt>('prompts', prompt);
        return this.convertToCustomPrompt(result, false);
      }
    } catch (error) {
      console.error('Error adding custom prompt:', error);
      throw error;
    }
  }

  // Prompt veya Rule güncelleme
  static async updateCustomPrompt(id: string, updates: Partial<Omit<CustomPrompt, 'id'>>): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Önce öğeyi bul
      const existingItem = await this.getById(id);
      
      if (!existingItem) {
        throw new Error('Prompt or Rule not found');
      }
      
      const now = new Date().toISOString();
      
      if (existingItem.isRule) {
        // Rule güncelle
        const rule = await this.storageService.getById<Rule>('rules', id);
        
        if (!rule) {
          throw new Error('Rule not found');
        }
        
        const updatedRule: Rule = {
          ...rule,
          ...updates,
          updatedAt: now
        };
        
        await this.storageService.update<Rule>('rules', updatedRule);
      } else {
        // Prompt güncelle
        const prompt = await this.storageService.getById<Prompt>('prompts', id);
        
        if (!prompt) {
          throw new Error('Prompt not found');
        }
        
        const updatedPrompt: Prompt = {
          ...prompt,
          ...updates,
          updatedAt: now
        };
        
        await this.storageService.update<Prompt>('prompts', updatedPrompt);
      }
    } catch (error) {
      console.error('Error updating custom prompt:', error);
      throw error;
    }
  }

  // Prompt veya Rule silme
  static async deleteCustomPrompt(id: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Önce öğeyi bul
      const existingItem = await this.getById(id);
      
      if (!existingItem) {
        throw new Error('Prompt or Rule not found');
      }
      
      if (existingItem.isRule) {
        // Rule sil
        await this.storageService.delete('rules', id);
      } else {
        // Prompt sil
        await this.storageService.delete('prompts', id);
      }
    } catch (error) {
      console.error('Error deleting custom prompt:', error);
      throw error;
    }
  }

  // AI'a gönderilecek promptu hazırla
  static async getPromptsFromLibrary(promptId: string, selectedRuleIds: string[] = [], options: PromptOptions): Promise<string> {
    // Sistem prompt'unu al
    const basePrompt = this.library[promptId];

    if (!basePrompt) {
      throw new Error('Prompt not found');
    }

    let finalPrompt = basePrompt.get(options);

    // Eğer kurallar seçildiyse, bunları prompt'a ekle
    if (selectedRuleIds.length > 0) {
      const rules: Rule[] = [];
      
      for (const ruleId of selectedRuleIds) {
        const rule = await this.storageService.getById<Rule>('rules', ruleId);
        if (rule) {
          rules.push(rule);
        }
      }
      
      // Kuralları önceliğe göre sırala
      rules.sort((a, b) => b.priority - a.priority);
      
      // Kuralları prompt'a ekle
      if (rules.length > 0) {
        finalPrompt += "\n\n# Additional Rules:\n";
        
        for (const rule of rules) {
          finalPrompt += `\n## ${rule.label}\n${rule.content}\n`;
        }
      }
    }

    return finalPrompt;
  }

  // Geriye dönük uyumluluk için mevcut fonksiyon
  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Not Found';
    }

    // Base prompt'u al
    let systemPrompt = this.library[promptId]?.get(options);

    // Client-side'da rule'ları ekle
    if (typeof localStorage !== 'undefined') {
      try {
        // Seçili rule ID'lerini al
        const selectedRulesStr = localStorage.getItem('bolt_selected_rules');
        if (selectedRulesStr) {
          const selectedRuleIds = JSON.parse(selectedRulesStr);
          
          if (selectedRuleIds.length > 0) {
            // Rule'ları getir
            const allItems = this.getCustomPromptsSync();
            const rules = allItems.filter(item => 
              item.isRule || (item.label && item.label.includes('[Rule]'))
            );
            
            // Seçili rule'ları filtrele
            const selectedRules = rules.filter(rule => selectedRuleIds.includes(rule.id));
            
            if (selectedRules.length > 0) {
              // Önceliğe göre sırala (yüksek öncelik önce)
              selectedRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
              
              // Rule'ları prompt'a ekle
              systemPrompt += "\n\n# Additional Rules:\n";
              
              for (const rule of selectedRules) {
                systemPrompt += `\n## ${rule.label}\n${rule.content}\n`;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error applying rules to prompt:', error);
      }
    }

    return systemPrompt;
  }

  // Prompts veya Rules nesnesini CustomPrompt'a dönüştürme
  private static convertToCustomPrompt(item: Prompt | Rule, isRule: boolean): CustomPrompt {
    if (isRule) {
      const rule = item as Rule;
      return {
        id: rule.id,
        label: rule.label,
        description: rule.description,
        content: rule.content,
        category: rule.category,
        isSystem: rule.isSystem,
        sourceUrl: rule.sourceUrl,
        isRule: true,
        priority: rule.priority,
        version: rule.version,
        tags: rule.tags,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      };
    } else {
      const prompt = item as Prompt;
      return {
        id: prompt.id,
        label: prompt.label,
        description: prompt.description,
        content: prompt.content,
        category: prompt.category,
        isSystem: prompt.isSystem,
        sourceUrl: prompt.sourceUrl,
        isRule: false,
        version: prompt.version,
        tags: prompt.tags,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt
      };
    }
  }

  // Veritabanının başlatıldığından emin olma yardımcısı
  private static async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
}
