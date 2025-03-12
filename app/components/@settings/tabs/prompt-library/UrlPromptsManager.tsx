import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { 
  addPromptUpdateUrl, 
  removePromptUpdateUrl, 
  getPromptUpdateUrls, 
  addPromptsFromUrl,
  checkAndUpdatePrompts
} from '~/lib/common/prompts/url-fetcher';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { logStore } from '~/lib/stores/logs';
import { PromptLibrary } from '~/lib/common/prompt-library';

interface UrlPromptFormData {
  url: string;
  label: string;
  checkIntervalHours: number;
  itemType: 'prompts' | 'rules';
  category: string;
  newCategory?: string;
}

const initialFormData: UrlPromptFormData = {
  url: '',
  label: '',
  checkIntervalHours: 24,
  itemType: 'prompts',
  category: 'Custom',
  newCategory: ''
};

export default function UrlPromptsManager({ onImportComplete }: { onImportComplete?: (itemType: 'prompts' | 'rules') => void }) {
  const [promptUrls, setPromptUrls] = useState(getPromptUpdateUrls());
  const [formData, setFormData] = useState<UrlPromptFormData>(initialFormData);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  
  // Load prompt URLs on component mount
  useEffect(() => {
    loadPromptUrls();
    loadCategories();
  }, []);
  
  // Reload prompt URLs
  const loadPromptUrls = () => {
    setPromptUrls(getPromptUpdateUrls());
  };
  
  // Load categories
  const loadCategories = () => {
    setCategories(PromptLibrary.getCategoriesSync());
  };
  
  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'category' && value === '__new__') {
      // Handle "Add new category" selection
      setShowNewCategoryInput(true);
      return;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'checkIntervalHours' ? Number(value) : value,
    }));
  };
  
  // Handle adding a new category
  const handleAddCategory = () => {
    if (!formData.newCategory?.trim()) {
      toast.error('Please enter a category name');
      return;
    }
    
    const newCategoryName = formData.newCategory.trim();
    
    // Check if category already exists
    if (categories.includes(newCategoryName)) {
      toast.error('Category already exists');
      return;
    }
    
    // We add a temporary prompt with this category to make it appear in the categories list
    // This is how categories are managed in the PromptLibrary system
    try {
      PromptLibrary.addCustomPrompt({
        label: `__temp_${Date.now()}`,
        description: 'Temporary item for category creation',
        content: 'This is a temporary item that will be deleted automatically.',
        category: newCategoryName
      });
      
      // Reload categories
      loadCategories();
      
      // Update form data
      setFormData(prev => ({
        ...prev,
        category: newCategoryName,
        newCategory: ''
      }));
      
      // Hide new category input
      setShowNewCategoryInput(false);
      
      toast.success(`Category "${newCategoryName}" created`);
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };
  
  // Handle add URL submission
  const handleAddUrl = () => {
    if (!formData.url.trim()) {
      toast.error('URL is required');
      return;
    }
    
    try {
      // Validate URL
      new URL(formData.url);
      
      // Add URL to the list
      addPromptUpdateUrl(
        formData.url,
        formData.label.trim() || 'Unnamed Source',
        formData.checkIntervalHours,
        formData.itemType,
        formData.category
      );
      
      logStore.logSystem(`Added URL source: ${formData.url}`);
      
      // Fetch prompts from the URL immediately
      handleFetchNow(formData.url, formData.itemType, formData.category);
      
      // Reset form and close dialog
      setFormData(initialFormData);
      setIsAddingUrl(false);
      setShowNewCategoryInput(false);
      
      // Reload prompt URLs
      loadPromptUrls();
      
      toast.success('URL added successfully');
    } catch (error) {
      console.error('Error adding URL:', error);
      toast.error('Invalid URL format');
    }
  };
  
  // Handle remove URL
  const handleRemoveUrl = (url: string) => {
    try {
      removePromptUpdateUrl(url);
      loadPromptUrls();
      toast.success('URL removed successfully');
      logStore.logSystem(`Removed URL source: ${url}`);
    } catch (error) {
      console.error('Error removing URL:', error);
      toast.error('Failed to remove URL');
    }
  };
  
  // Handle fetch prompts from URL now
  const handleFetchNow = async (
    url: string, 
    itemType: 'prompts' | 'rules' = 'prompts',
    defaultCategory: string = 'Custom'
  ) => {
    setIsLoading(true);
    
    try {
      // If URL starts with @ symbol, consider it a special indicator to use as raw URL
      const processedUrl = url.startsWith('@') ? url.substring(1) : url;
      
      // Show loading feedback
      toast.info(`Fetching ${itemType} from URL...`, {
        autoClose: 2000
      });
      
      const addedPrompts = await addPromptsFromUrl(processedUrl, itemType, defaultCategory);
      
      if (addedPrompts.length > 0) {
        toast.success(`Successfully added ${addedPrompts.length} ${itemType} from URL`);
        logStore.logSystem(`Added ${addedPrompts.length} ${itemType} from ${url}`);
        
        // If we have a callback, call it to switch to the appropriate tab
        if (onImportComplete) {
          onImportComplete(itemType);
        }
      } else {
        toast.info(`No valid ${itemType} found at URL`);
      }
    } catch (error) {
      console.error('Error fetching prompts:', error);
      
      // Format a user-friendly error message
      let errorMessage = `Failed to fetch ${itemType} from URL`;
      
      if (error instanceof Error) {
        // Include specific error message if available
        errorMessage += `: ${error.message}`;
        
        // Special handling for common issues
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          errorMessage = `Network error: Please check your connection or if the URL is accessible`;
        } else if (error.message.includes('404')) {
          errorMessage = `URL not found (404): The requested resource does not exist`;
        } else if (error.message.includes('CORS')) {
          errorMessage = `CORS error: The server doesn't allow access from this application`;
        }
      }
      
      toast.error(errorMessage);
      
      logStore.logWarning(`Failed to fetch from URL: ${url}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        url
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle check all URLs for updates
  const handleCheckAllUpdates = async () => {
    setIsLoading(true);
    
    try {
      const updatedCount = await checkAndUpdatePrompts();
      
      if (updatedCount > 0) {
        toast.success(`Updated ${updatedCount} items from URLs`);
        logStore.logSystem(`Updated ${updatedCount} items from URLs`);
        
        // If we have a callback, call it (with 'prompts' as default)
        // Note: We don't know which type was updated, so we default to prompts
        if (onImportComplete) {
          onImportComplete('prompts');
        }
      } else {
        toast.info('No updates found');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      toast.error('Failed to check for updates');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">URL Sources</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddingUrl(true)}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
              'bg-purple-500 text-white',
              'hover:bg-purple-600 transition-colors duration-200',
            )}
          >
            <div className="i-ph:plus-circle w-4 h-4" />
            Add Source URL
          </button>
          
          <button
            onClick={handleCheckAllUpdates}
            disabled={isLoading || promptUrls.length === 0}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
              'text-gray-700 dark:text-gray-300',
              'bg-gray-100 hover:bg-gray-200 dark:bg-[#1A1A1A] dark:hover:bg-[#252525]',
              'transition-colors duration-200',
              (isLoading || promptUrls.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
            )}
          >
            <div className={isLoading ? "i-ph:spinner-gap animate-spin w-4 h-4" : "i-ph:cloud-arrow-down w-4 h-4"} />
            Check All Updates
          </button>
        </div>
      </div>
      
      {/* URL List */}
      {promptUrls.length > 0 ? (
        <div className="space-y-2">
          {promptUrls.map((urlItem) => (
            <div
              key={urlItem.url}
              className={classNames(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-gray-100 dark:bg-[#1A1A1A]',
              )}
            >
              <div className="flex-1 overflow-hidden">
                <div className="font-medium text-gray-900 dark:text-white truncate">{urlItem.label}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{urlItem.url}</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Check interval: {urlItem.checkIntervalHours} hours | 
                  Last checked: {urlItem.lastChecked ? new Date(urlItem.lastChecked).toLocaleString() : 'Never'}
                  {urlItem.itemType && ` | Type: ${urlItem.itemType}`}
                  {urlItem.defaultCategory && ` | Category: ${urlItem.defaultCategory}`}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleFetchNow(
                    urlItem.url, 
                    urlItem.itemType || 'prompts', 
                    urlItem.defaultCategory || 'Custom'
                  )}
                  disabled={isLoading}
                  className={classNames(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-sm',
                    'text-gray-700 dark:text-gray-300',
                    'bg-gray-200 hover:bg-gray-300 dark:bg-[#252525] dark:hover:bg-[#333]',
                    'transition-colors duration-200',
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  )}
                >
                  <div className={isLoading ? "i-ph:spinner-gap animate-spin w-3.5 h-3.5" : "i-ph:download-simple w-3.5 h-3.5"} />
                  Fetch Now
                </button>
                
                <button
                  onClick={() => handleRemoveUrl(urlItem.url)}
                  className={classNames(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-sm',
                    'text-red-500',
                    'bg-red-500/10 hover:bg-red-500/20',
                    'transition-colors duration-200'
                  )}
                >
                  <div className="i-ph:trash w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 dark:text-gray-400">
          <div className="i-ph:cloud-slash w-10 h-10 mb-2" />
          <p>No URL sources added yet</p>
          <p className="text-sm mt-1">Add a URL to automatically fetch and update prompts</p>
        </div>
      )}
      
      {/* Add URL Dialog */}
      <DialogRoot open={isAddingUrl} onOpenChange={setIsAddingUrl}>
        <Dialog className="max-w-3xl p-8">
          <DialogTitle className="text-xl">Add Source URL</DialogTitle>
          <DialogDescription className="pb-4 mt-2">
            Add a URL that contains prompt or rule definitions. Supports multiple file formats:
            <ul className="mt-3 text-sm list-disc pl-5 space-y-2">
              <li><strong>JSON</strong> - Array of items with label, content, description, and category fields</li>
              <li><strong>Markdown</strong> - Uses # headings as item labels and content below them</li>
              <li><strong>Text/Doc</strong> - Treats the entire document as a single item</li>
            </ul>
          </DialogDescription>
          
          <div className="mt-8 space-y-6 px-2">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Label</label>
              <input
                type="text"
                name="label"
                value={formData.label}
                onChange={handleInputChange}
                placeholder="My Prompt Source"
                className={classNames(
                  'w-full px-4 py-3 rounded-lg text-sm',
                  'bg-white dark:bg-[#111]',
                  'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                  'text-gray-900 dark:text-gray-100',
                  'outline-none transition-colors duration-200'
                )}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleInputChange}
                placeholder="https://example.com/prompts.json"
                className={classNames(
                  'w-full px-4 py-3 rounded-lg text-sm',
                  'bg-white dark:bg-[#111]',
                  'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                  'text-gray-900 dark:text-gray-100',
                  'outline-none transition-colors duration-200'
                )}
                required
              />
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>Enter a URL to a JSON, Markdown, or text file.</p>
                <p>For GitHub files, you can use either:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>Regular GitHub URL: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">https://github.com/user/repo/blob/main/file.md</span></li>
                  <li>Raw URL: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">https://raw.githubusercontent.com/user/repo/main/file.md</span></li>
                  <li>Or prefix with @ symbol: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">@https://github.com/user/repo/blob/main/file.md</span></li>
                </ul>
              </div>
            </div>
            
            {/* Item Type and Category in a single row */}
            <div className="flex gap-4">
              <div className="w-1/2">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Item Type</label>
                <select
                  name="itemType"
                  value={formData.itemType}
                  onChange={handleInputChange}
                  className={classNames(
                    'w-full px-4 py-3 rounded-lg text-sm',
                    'bg-white dark:bg-[#111]',
                    'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                    'text-gray-900 dark:text-gray-100',
                    'outline-none transition-colors duration-200'
                  )}
                >
                  <option value="prompts">Prompts</option>
                  <option value="rules">Rules</option>
                </select>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Select whether items from this URL should be treated as prompts or rules.
                </p>
              </div>
              
              <div className="w-1/2">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Category</label>
                {!showNewCategoryInput ? (
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={classNames(
                      'w-full px-4 py-3 rounded-lg text-sm',
                      'bg-white dark:bg-[#111]',
                      'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                      'text-gray-900 dark:text-gray-100',
                      'outline-none transition-colors duration-200'
                    )}
                  >
                    <option value="Custom">Custom</option>
                    {categories.filter(c => c !== 'Custom').map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                    <option value="__new__">+ Add New Category</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="newCategory"
                      value={formData.newCategory || ''}
                      onChange={handleInputChange}
                      placeholder="New Category Name"
                      className={classNames(
                        'flex-1 px-4 py-3 rounded-lg text-sm',
                        'bg-white dark:bg-[#111]',
                        'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                        'text-gray-900 dark:text-gray-100',
                        'outline-none transition-colors duration-200'
                      )}
                    />
                    <button
                      onClick={handleAddCategory}
                      className={classNames(
                        'px-3 py-2 rounded-lg text-sm',
                        'bg-purple-500 text-white',
                        'hover:bg-purple-600 transition-colors duration-200',
                      )}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setFormData(prev => ({ ...prev, category: 'Custom' }));
                      }}
                      className={classNames(
                        'px-2 py-2 rounded-lg text-sm',
                        'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
                        'hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200',
                      )}
                    >
                      <div className="i-ph:x w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Select the default category for items. If an item has its own category, that will be used instead.
                </p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Check Interval (hours)</label>
              <input
                type="number"
                name="checkIntervalHours"
                value={formData.checkIntervalHours}
                onChange={handleInputChange}
                min={1}
                max={720}
                className={classNames(
                  'w-full px-4 py-3 rounded-lg text-sm',
                  'bg-white dark:bg-[#111]',
                  'border border-gray-300 dark:border-[#333] focus:border-purple-500 dark:focus:border-purple-500',
                  'text-gray-900 dark:text-gray-100',
                  'outline-none transition-colors duration-200'
                )}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-4 mt-10">
            <DialogButton type="secondary" onClick={() => setIsAddingUrl(false)}>
              Cancel
            </DialogButton>
            <DialogButton type="primary" onClick={handleAddUrl}>
              Add URL
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>
    </div>
  );
} 