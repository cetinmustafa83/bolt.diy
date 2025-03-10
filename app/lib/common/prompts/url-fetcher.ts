import type { CustomPrompt } from '../prompt-library';
import { PromptLibrary } from '../prompt-library';

interface FetchedPrompt {
  label: string;
  description: string;
  content: string;
  category: string;
}

/**
 * Extracts file extension from URL
 * @param url The URL to extract extension from
 */
function getFileExtension(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastDotIndex = pathname.lastIndexOf('.');
    
    if (lastDotIndex === -1) return null;
    
    return pathname.slice(lastDotIndex + 1).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parses JSON content to extract prompts
 * @param content JSON content
 */
function parseJsonContent(content: string): FetchedPrompt[] {
  try {
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format: expected an array of prompts');
    }
    
    // Validate each prompt
    const validPrompts = data.filter((prompt) => {
      return (
        typeof prompt === 'object' &&
        prompt !== null &&
        typeof prompt.label === 'string' &&
        typeof prompt.content === 'string' &&
        prompt.label.trim() !== '' &&
        prompt.content.trim() !== ''
      );
    });
    
    return validPrompts.map((prompt) => ({
      label: prompt.label,
      description: prompt.description || 'No description provided',
      content: prompt.content,
      category: prompt.category || 'Custom',
    }));
  } catch (error) {
    console.error('Error parsing JSON content:', error);
    throw error;
  }
}

/**
 * Parses markdown content to extract prompts
 * @param content Markdown content
 */
function parseMarkdownContent(content: string): FetchedPrompt[] {
  try {
    const lines = content.split('\n');
    const prompts: FetchedPrompt[] = [];
    let currentPrompt: Partial<FetchedPrompt> | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for headings as prompt titles
      if (line.startsWith('# ')) {
        // If we were working on a prompt, save it
        if (currentPrompt && currentPrompt.label && currentPrompt.content) {
          prompts.push({
            label: currentPrompt.label,
            description: currentPrompt.description || 'Extracted from Markdown',
            content: currentPrompt.content,
            category: currentPrompt.category || 'Custom',
          });
        }
        
        // Start a new prompt
        currentPrompt = {
          label: line.substring(2).trim(),
          content: '',
        };
      } else if (line.startsWith('## ') && currentPrompt) {
        // Second level headings could be metadata
        const heading = line.substring(3).trim().toLowerCase();
        
        if (heading === 'description' || heading === 'desc') {
          // Next line is the description
          if (i + 1 < lines.length) {
            currentPrompt.description = lines[i + 1].trim();
            i++; // Skip the next line
          }
        } else if (heading === 'category' || heading === 'cat') {
          // Next line is the category
          if (i + 1 < lines.length) {
            currentPrompt.category = lines[i + 1].trim();
            i++; // Skip the next line
          }
        }
      } else if (currentPrompt) {
        // Add to content (with proper spacing)
        if (currentPrompt.content) {
          currentPrompt.content += '\n' + line;
        } else {
          currentPrompt.content = line;
        }
      }
    }
    
    // Don't forget the last prompt
    if (currentPrompt && currentPrompt.label && currentPrompt.content) {
      prompts.push({
        label: currentPrompt.label,
        description: currentPrompt.description || 'Extracted from Markdown',
        content: currentPrompt.content,
        category: currentPrompt.category || 'Custom',
      });
    }
    
    return prompts;
  } catch (error) {
    console.error('Error parsing markdown content:', error);
    throw error;
  }
}

/**
 * Parses plain text content to extract prompts
 * @param content Text content
 */
function parseTextContent(content: string, fileName?: string): FetchedPrompt[] {
  try {
    // Generate a label from the filename or use a default
    const label = fileName 
      ? fileName.replace(/\.\w+$/, '') // Remove file extension
      : `Rule ${new Date().toLocaleString()}`;
    
    // Clean the content a bit
    const cleanedContent = content.trim()
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n'); // Reduce excessive blank lines
      
    // Look for sections to generate a proper description
    let description = 'Imported from text file';
    
    const firstLines = cleanedContent.split('\n', 5).join('\n');
    
    // Try to extract a description from the first few lines if they look like a header/title area
    if (firstLines.includes('#') || firstLines.includes('Title:') || firstLines.includes('Description:')) {
      // Get first 200 chars to use as description
      description = firstLines.substring(0, 200);
      
      // If it ends mid-word/sentence, add ellipsis
      if (description.length === 200) {
        description += '...';
      }
    }
    
    // Category based on file name
    const categoryGuess = fileName?.includes('.') 
      ? fileName.split('.').pop()?.toUpperCase() || 'Custom' 
      : 'Custom';
    
    return [{
      label,
      description,
      content: cleanedContent,
      category: categoryGuess,
    }];
  } catch (error) {
    console.error('Error parsing text content:', error);
    throw error;
  }
}

/**
 * Detects content type from content and URL
 * @param content The content to analyze
 * @param url The URL the content was fetched from
 */
function detectContentType(content: string, url: string): 'json' | 'markdown' | 'text' {
  // Check file extension first
  const extension = getFileExtension(url);
  
  if (extension) {
    if (['json'].includes(extension)) {
      return 'json';
    } else if (['md', 'markdown'].includes(extension)) {
      return 'markdown';
    } else if (['txt', 'text', 'doc', 'docx'].includes(extension)) {
      return 'text';
    }
  }
  
  // If no extension or unknown extension, try to guess from content
  const trimmedContent = content.trim();
  
  // Check if it looks like JSON
  if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) || 
      (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
    try {
      JSON.parse(trimmedContent);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // Check if it looks like Markdown (has headers)
  if (trimmedContent.includes('# ') || trimmedContent.includes('\n## ')) {
    return 'markdown';
  }
  
  // Default to text
  return 'text';
}

/**
 * Converts GitHub URLs to raw GitHub URLs
 * @param url The GitHub URL to convert
 */
function convertGitHubUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a GitHub URL
    if (urlObj.hostname === 'github.com') {
      // Replace github.com with raw.githubusercontent.com and remove /blob
      const path = urlObj.pathname.replace('/blob/', '/');
      return `https://raw.githubusercontent.com${path}`;
    }
    
    return url;
  } catch {
    return url;
  }
}

/**
 * Fetches prompts from a URL and returns them as an array of FetchedPrompt objects
 * @param url The URL to fetch prompts from
 * @returns Promise<FetchedPrompt[]> An array of fetched prompts
 */
export async function fetchPromptsFromUrl(url: string): Promise<FetchedPrompt[]> {
  try {
    // Convert GitHub URLs to raw format
    const fetchUrl = convertGitHubUrl(url);
    console.log(`Fetching from URL: ${fetchUrl}`);
    
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch prompts: ${response.statusText}`);
    }
    
    // Get the raw text content
    const content = await response.text();
    
    // Detect content type and parse accordingly
    const contentType = detectContentType(content, url);
    
    let prompts: FetchedPrompt[] = [];
    
    switch (contentType) {
      case 'json':
        prompts = parseJsonContent(content);
        break;
      case 'markdown':
        prompts = parseMarkdownContent(content);
        break;
      case 'text':
        // Extract file name from URL to use as prompt label
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const fileName = pathParts[pathParts.length - 1];
        prompts = parseTextContent(content, fileName);
        break;
    }
    
    return prompts;
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
}

/**
 * Adds prompts from a URL to the prompt library
 * @param url The URL to fetch prompts from
 * @param itemType The type of items to add ('prompts' or 'rules')
 * @param defaultCategory The default category for the prompts if not specified
 * @returns Promise<CustomPrompt[]> An array of added prompts
 */
export async function addPromptsFromUrl(
  url: string, 
  itemType: 'prompts' | 'rules' = 'prompts',
  defaultCategory: string = 'Custom'
): Promise<CustomPrompt[]> {
  const fetchedPrompts = await fetchPromptsFromUrl(url);
  const addedPrompts: CustomPrompt[] = [];
  
  for (const prompt of fetchedPrompts) {
    // Set the category to the default if not specified
    const category = prompt.category || defaultCategory;
    
    // Prepare the base prompt data
    const promptData = {
      ...prompt,
      category,
      sourceUrl: url
    };
    
    // For rules, add special rule identifier to the label and ID
    if (itemType === 'rules') {
      // If the label doesn't already end with [Rule], add it
      if (!promptData.label.endsWith('[Rule]')) {
        promptData.label = `${promptData.label} [Rule]`;
      }
      
      // Generate a temporary ID prefix that helps identify it as a rule
      // Note: This will be overwritten by the PromptLibrary.addCustomPrompt function
      // but it helps the component know this is a rule
      const tempId = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Add the prompt with rule marker
      const newPrompt = PromptLibrary.addCustomPrompt({
        ...promptData,
        // Custom field to identify it as a rule - this will persist
        isRule: true
      } as any);  // Using any here to add the isRule property since it's not in the interface
      
      addedPrompts.push(newPrompt);
    } else {
      // Regular prompt
      const newPrompt = PromptLibrary.addCustomPrompt(promptData);
      addedPrompts.push(newPrompt);
    }
  }
  
  return addedPrompts;
}

// Store for URLs that should be checked periodically
const PROMPT_URLS_STORAGE_KEY = 'bolt_prompt_update_urls';

interface PromptUpdateUrl {
  url: string;
  label: string;
  lastChecked: number;
  checkIntervalHours: number;
  itemType?: 'prompts' | 'rules';
  defaultCategory?: string;
}

/**
 * Gets all URLs that should be checked for prompt updates
 */
export function getPromptUpdateUrls(): PromptUpdateUrl[] {
  const stored = localStorage.getItem(PROMPT_URLS_STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Adds a URL to the list of URLs that should be checked for prompt updates
 * @param url The URL to add
 * @param label A descriptive label for the URL
 * @param checkIntervalHours How often to check the URL for updates (in hours)
 * @param itemType Whether items from this URL are prompts or rules
 * @param defaultCategory The default category for items from this URL
 */
export function addPromptUpdateUrl(
  url: string, 
  label: string, 
  checkIntervalHours = 24,
  itemType: 'prompts' | 'rules' = 'prompts',
  defaultCategory: string = 'Custom'
): void {
  const urls = getPromptUpdateUrls();
  
  // Check if URL already exists
  const existingIndex = urls.findIndex(item => item.url === url);
  
  if (existingIndex !== -1) {
    // Update existing entry
    urls[existingIndex] = {
      ...urls[existingIndex],
      label,
      checkIntervalHours,
      itemType,
      defaultCategory
    };
  } else {
    // Add new entry
    urls.push({
      url,
      label,
      lastChecked: 0, // Never checked
      checkIntervalHours,
      itemType,
      defaultCategory
    });
  }
  
  localStorage.setItem(PROMPT_URLS_STORAGE_KEY, JSON.stringify(urls));
}

/**
 * Removes a URL from the list of URLs that should be checked for prompt updates
 * @param url The URL to remove
 */
export function removePromptUpdateUrl(url: string): void {
  const urls = getPromptUpdateUrls();
  const newUrls = urls.filter(item => item.url !== url);
  localStorage.setItem(PROMPT_URLS_STORAGE_KEY, JSON.stringify(newUrls));
}

/**
 * Updates the last checked timestamp for a URL
 * @param url The URL to update
 */
export function updateLastChecked(url: string): void {
  const urls = getPromptUpdateUrls();
  const index = urls.findIndex(item => item.url === url);
  
  if (index !== -1) {
    urls[index].lastChecked = Date.now();
    localStorage.setItem(PROMPT_URLS_STORAGE_KEY, JSON.stringify(urls));
  }
}

/**
 * Checks all URLs that are due for an update and updates the prompts
 * @returns Promise<number> The number of prompts that were updated
 */
export async function checkAndUpdatePrompts(): Promise<number> {
  const urls = getPromptUpdateUrls();
  let updatedCount = 0;
  
  const now = Date.now();
  
  for (const urlItem of urls) {
    // Check if it's time to update
    const hoursSinceLastCheck = (now - urlItem.lastChecked) / (1000 * 60 * 60);
    
    if (hoursSinceLastCheck >= urlItem.checkIntervalHours) {
      try {
        // Get item type and category (use defaults if not stored)
        const itemType = urlItem.itemType || 'prompts';
        const defaultCategory = urlItem.defaultCategory || 'Custom';
        
        // Fetch prompts from URL
        const fetchedPrompts = await fetchPromptsFromUrl(urlItem.url);
        
        // Get existing prompts with the same source URL
        const existingPrompts = PromptLibrary.getCustomPrompts().filter(
          prompt => prompt.sourceUrl === urlItem.url
        );
        
        // Update existing prompts or add new ones
        for (const fetchedPrompt of fetchedPrompts) {
          // Use the specified default category if fetchedPrompt doesn't have one
          const category = fetchedPrompt.category || defaultCategory;
          
          const existingPrompt = existingPrompts.find(
            p => p.label === fetchedPrompt.label
          );
          
          if (existingPrompt) {
            // Update existing prompt if content is different
            if (existingPrompt.content !== fetchedPrompt.content) {
              PromptLibrary.updateCustomPrompt(existingPrompt.id, {
                description: fetchedPrompt.description,
                content: fetchedPrompt.content,
                category,
              });
              updatedCount++;
            }
          } else {
            // Add new prompt
            let promptToAdd = {
              ...fetchedPrompt,
              category,
              sourceUrl: urlItem.url,
            };
            
            // For rules, modify the label
            if (itemType === 'rules') {
              promptToAdd.label = `${promptToAdd.label} [Rule]`;
            }
            
            PromptLibrary.addCustomPrompt(promptToAdd);
            updatedCount++;
          }
        }
        
        // Update last checked timestamp
        updateLastChecked(urlItem.url);
      } catch (error) {
        console.error(`Error updating prompts from ${urlItem.url}:`, error);
      }
    }
  }
  
  return updatedCount;
} 