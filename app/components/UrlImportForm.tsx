import { useState, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Select } from '~/components/ui/Select';
import { Switch } from '~/components/ui/Switch';
import { Label } from '~/components/ui/Label';
import { fetchFromUrl, validateUrl, scheduleUrlCheck, saveImportedContent, getCategories } from '~/utils/importHelpers';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';

interface ImportConfig {
  url: string;
  type: 'prompt' | 'rules';
  format: 'text' | 'csv' | 'json' | 'html' | 'url';
  category: string;
  autoCheck: boolean;
  checkInterval?: number;
}

interface UrlImportFormProps {
  onClose?: () => void;
  defaultType?: 'prompt' | 'rules';
}

export function UrlImportForm({ onClose, defaultType = 'prompt' }: UrlImportFormProps) {
  const [config, setConfig] = useState<ImportConfig>({
    url: '',
    type: defaultType,
    format: 'text',
    category: '',
    autoCheck: false,
    checkInterval: 60, // Default 60 minutes
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load categories when type changes
  useEffect(() => {
    loadCategories();
  }, [config.type]);

  const loadCategories = async () => {
    try {
      const loadedCategories = await getCategories(config.type);
      setCategories(loadedCategories);
    } catch {
      console.error('Error loading categories');
      toast.error('Failed to load categories');
    }
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (config.autoCheck && config.url && config.checkInterval) {
      cleanup = scheduleUrlCheck(config.url, config.format, config.checkInterval, async (data) => {
        try {
          await handleImport(data.content, data.metadata);
          toast.success('Content updated from URL');
        } catch {
          toast.error('Failed to update content from URL');
        }
      });
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [config.autoCheck, config.url, config.format, config.checkInterval]);

  const handleUrlChange = async (url: string) => {
    setConfig({ ...config, url });

    if (url) {
      setIsValidating(true);

      const isValid = await validateUrl(url);
      setIsValidating(false);

      if (!isValid) {
        toast.error('Invalid URL');
      }
    }
  };

  const handleImport = async (content: string, metadata?: Record<string, any>) => {
    try {
      console.log('Starting import with:', { content, metadata, config });

      if (!content.trim()) {
        throw new Error('Content cannot be empty');
      }

      if (!config.category) {
        throw new Error('Category is required');
      }

      // First, ensure the category exists by creating a temporary prompt
      const tempPrompt = await PromptLibrary.addCustomPrompt({
        label: `__temp_${Date.now()}`,
        description: 'Temporary prompt for category creation',
        content: 'This is a temporary prompt to create a new category.',
        category: config.category,
      });
      console.log('Created temporary prompt:', tempPrompt);

      // Delete the temporary prompt
      await PromptLibrary.deleteCustomPrompt(tempPrompt.id);
      console.log('Deleted temporary prompt');

      // Now save the actual prompt/rule
      const label = metadata?.title || `Imported from ${config.url}`;
      const description = metadata?.description || `Content imported from ${config.url}`;

      const savedItem = await PromptLibrary.addCustomPrompt({
        label,
        description,
        content,
        category: config.category,
        id: config.type === 'rules' ? `rule_${Date.now()}` : undefined,
      });

      console.log('Saved item:', savedItem);

      // Also save to localStorage for backup
      await saveImportedContent(content, config.type, config.category, metadata);
      console.log('Saved to localStorage');

      // Show success message with the actual saved item name
      toast.success(`${config.type === 'rules' ? 'Rule' : 'Prompt'} imported successfully: ${savedItem.label}`);

      // Close the dialog and reset form
      onClose?.();
      setConfig({
        ...config,
        url: '',
        autoCheck: false,
      });
    } catch (error) {
      console.error('Import error:', error);

      if (error instanceof Error) {
        toast.error(`Import failed: ${error.message}`);
      } else {
        toast.error('Failed to import content. Please try again.');
      }

      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.url) {
      toast.error('Please enter a URL');
      return;
    }

    if (!config.category) {
      toast.error('Please select or create a category');
      return;
    }

    setIsSubmitting(true);

    try {
      // First validate the URL
      const isValid = await validateUrl(config.url);

      if (!isValid) {
        toast.error('The URL is not accessible. Please check the URL and try again.');
        return;
      }

      // Try to fetch and import the content
      const data = await fetchFromUrl(config.url, config.format);

      if (!data.content.trim()) {
        toast.error('The URL returned empty content');
        return;
      }

      // Save the imported content
      await handleImport(data.content, data.metadata);
      toast.success('Content imported successfully');

      // Reset form and close dialog
      setConfig({
        ...config,
        url: '',
        autoCheck: false,
      });
      onClose?.();
    } catch {
      // Show fallback error message
      toast.error('Failed to import content. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    if (newCategory.trim()) {
      const newCat = newCategory.trim();

      try {
        // Create a temporary prompt to add the category (same logic as in PromptLibraryTab)
        const tempPrompt = await PromptLibrary.addCustomPrompt({
          label: `__temp_${Date.now()}`,
          description: 'Temporary prompt for category creation',
          content: 'This is a temporary prompt to create a new category.',
          category: newCat,
        });

        // Delete the temporary prompt immediately
        await PromptLibrary.deleteCustomPrompt(tempPrompt.id);

        // Update local state
        setCategories([...categories, newCat]);
        setConfig({ ...config, category: newCat });
        setNewCategory('');
        setShowNewCategory(false);

        toast.success('Category added successfully');
      } catch (error) {
        console.error('Error adding category:', error);
        toast.error('Failed to add category');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-gray-700 dark:text-gray-300">URL</Label>
        <Input
          type="url"
          value={config.url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUrlChange(e.target.value)}
          placeholder="Enter URL to import from"
          required
          disabled={isSubmitting}
          className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        />
        {isValidating && <p className="text-sm text-gray-500 dark:text-gray-400">Validating URL...</p>}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label className="text-gray-700 dark:text-gray-300">Type</Label>
          <Select
            value={config.type}
            onValueChange={(value: string) => setConfig({ ...config, type: value as 'prompt' | 'rules' })}
            disabled={isSubmitting}
            className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          >
            <option value="prompt">Prompt</option>
            <option value="rules">Rules</option>
          </Select>
        </div>

        <div className="flex-1">
          <Label className="text-gray-700 dark:text-gray-300">Format</Label>
          <Select
            value={config.format}
            onValueChange={(value: string) =>
              setConfig({
                ...config,
                format: value as 'text' | 'csv' | 'json' | 'html' | 'url',
              })
            }
            disabled={isSubmitting}
            className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          >
            <option value="text">Text</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="url">Direct URL</option>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-gray-700 dark:text-gray-300">Category</Label>
        {!showNewCategory ? (
          <div className="flex gap-2">
            <Select
              value={config.category}
              onValueChange={(value: string) => setConfig({ ...config, category: value })}
              className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              disabled={isSubmitting}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              onClick={() => setShowNewCategory(true)}
              variant="outline"
              disabled={isSubmitting}
              className="text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]"
            >
              New Category
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value)}
              placeholder="Enter new category name"
              className="flex-1 px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              disabled={isSubmitting}
            />
            <Button
              type="button"
              onClick={handleAddCategory}
              disabled={isSubmitting || !newCategory.trim()}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              Add
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowNewCategory(false)}
              disabled={isSubmitting}
              className="text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Switch
          checked={config.autoCheck}
          onCheckedChange={(checked: boolean) => setConfig({ ...config, autoCheck: checked })}
          className="data-[state=checked]:bg-purple-500 dark:bg-[#333] dark:data-[state=checked]:bg-purple-500"
        />
        <Label className="text-gray-700 dark:text-gray-300">Enable automatic checking</Label>
      </div>

      {config.autoCheck && (
        <div>
          <Label className="text-gray-700 dark:text-gray-300">Check Interval (minutes)</Label>
          <Input
            type="number"
            min="1"
            value={config.checkInterval}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfig({
                ...config,
                checkInterval: parseInt(e.target.value) || 60,
              })
            }
            disabled={isSubmitting}
            className="w-full px-3 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSubmitting}
          className="text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isValidating}
          className="bg-purple-500 hover:bg-purple-600 text-white"
        >
          {isSubmitting ? 'Importing...' : 'Import'}
        </Button>
      </div>
    </form>
  );
}
