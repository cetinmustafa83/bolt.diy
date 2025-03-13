import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { PromptLibrary, type CustomPrompt } from '~/lib/common/prompt-library';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { Switch } from '~/components/ui/Switch';
import { ScrollArea } from '~/components/ui/ScrollArea';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';
import { UrlImportForm } from '~/components/UrlImportForm';

interface PromptFormData {
  label: string;
  description: string;
  content: string;
  category: string;
}

export default function PromptLibraryTab() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'prompts' | 'rules'>('prompts');

  // Category Management modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ original: string; new: string } | null>(null);

  const { promptId, setPromptId, activePrompts, setActivePrompts } = useSettings();
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<CustomPrompt[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<CustomPrompt | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromptFormData>({
    label: '',
    description: '',
    content: '',
    category: 'Custom',
  });
  const [customCategory, setCustomCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [promptStates, setPromptStates] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<PromptFormData>({
    label: '',
    description: '',
    content: '',
    category: '',
  });

  // Load prompts on mount
  useEffect(() => {
    const initializePrompts = async () => {
      try {
        // First check if the rule exists
        const customPromptsData = await PromptLibrary.getCustomPrompts();
        const existingRule = customPromptsData.find((p) => p.id === 'rule_typescript_guidelines');

        // If rule doesn't exist, add it silently without toast messages
        if (!existingRule) {
          const guidelinesContent = `# TypeScript Project Guidelines

## Project Structure
- Use a clear and consistent directory structure
- Separate source code (src/) from build output (dist/)
- Keep related files together in feature-based directories
- Use meaningful file names that reflect their purpose

## TypeScript Configuration
- Maintain a strict tsconfig.json
- Enable strict type checking
- Use project references for large codebases
- Configure module resolution strategy
- Set appropriate target ECMAScript version`;

          await PromptLibrary.addCustomPrompt({
            id: 'rule_typescript_guidelines',
            label: 'TypeScript Project - Project Guidelines',
            description: 'Essential guidelines and best practices for TypeScript projects',
            content: guidelinesContent,
            category: 'Development',
          });
        }

        await loadPrompts();
      } catch (_error) {
        console.error('Error initializing prompts:', _error);
        toast.error('Failed to initialize prompts');
      }
    };

    initializePrompts();
  }, []);

  // Load and process prompts
  const loadPrompts = async () => {
    try {
      /*
       * Burada getList() boş bir dizi döndürüyor (SYSTEM_PROMPTS boş)
       * Bunun yerine library'deki sistem promptlarını alıyoruz
       */
      const systemPromptsFromLibrary = Object.entries(PromptLibrary.library).map(([id, prompt]) => ({
        id,
        label: prompt.label,
        description: prompt.description,
        content: 'System prompt content not directly accessible', // İçerik bir fonksiyon olduğu için doğrudan görüntüleyemiyoruz
        category: 'System',
        isSystem: true,
      }));

      setSystemPrompts(systemPromptsFromLibrary);

      const customPromptsData = await PromptLibrary.getCustomPrompts();
      setCustomPrompts(customPromptsData);

      const allCategories = await PromptLibrary.getCategories();

      // Sistem kategoriyi ekleyelim
      if (!allCategories.includes('System')) {
        allCategories.push('System');
      }

      setCategories(allCategories);

      // Initialize prompt states from active prompts
      const states: Record<string, boolean> = {};
      const allPrompts = [...systemPromptsFromLibrary, ...customPromptsData];

      /*
       * Sistem promptları varsayılan olarak aktif olsun
       * ve varolan aktif promptları da ekleyelim
       */
      const defaultActivePrompts = [
        ...systemPromptsFromLibrary.map((p) => p.id), // Tüm sistem promptları aktif
        ...activePrompts.filter((id) => customPromptsData.some((p) => p.id === id)), // Önceden seçilmiş özel promptlar
      ];

      // Tekrarlanan ID'leri temizle
      const uniqueActivePrompts = [...new Set(defaultActivePrompts)];

      // Only track state for prompts that actually exist
      const validActivePrompts = uniqueActivePrompts.filter((id) => allPrompts.some((prompt) => prompt.id === id));

      // Update active prompts if they changed
      if (JSON.stringify(validActivePrompts.sort()) !== JSON.stringify(activePrompts.sort())) {
        setActivePrompts(validActivePrompts);
      }

      // Set state only for prompts that exist
      allPrompts.forEach((prompt: CustomPrompt) => {
        // Sistem promptları her zaman aktif
        states[prompt.id] = prompt.isSystem ? true : validActivePrompts.includes(prompt.id);
      });

      setPromptStates(states);
    } catch (error) {
      console.error('Error loading prompts:', error);
      toast.error('Failed to load prompts');
    }
  };

  // Filter prompts by category
  const getFilteredPrompts = () => {
    const filtered = {
      system: systemPrompts.filter((p: CustomPrompt) => !activeCategory || p.category === activeCategory),
      custom: customPrompts.filter((p: CustomPrompt) => !activeCategory || p.category === activeCategory),
    };
    return filtered;
  };

  // Handle adding a new category
  const handleAddCategory = async () => {
    if (!customCategory.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (categories.includes(customCategory.trim())) {
      toast.error('Category already exists');
      return;
    }

    try {
      /*
       * Adding a category by creating a temporary prompt with this category
       * The category will be saved in localStorage and appear in the categories list
       */
      const tempPrompt = await PromptLibrary.addCustomPrompt({
        label: `__temp_${Date.now()}`,
        description: 'Temporary prompt for category creation',
        content: 'This is a temporary prompt to create a new category.',
        category: customCategory.trim(),
      });

      // Delete the temporary prompt immediately
      await PromptLibrary.deleteCustomPrompt(tempPrompt.id);

      logStore.logSystem(`Added new category: ${customCategory}`);
      toast.success('Category added successfully');
      setCustomCategory('');
      await loadPrompts();
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error('Failed to add category');
    }
  };

  // Handle editing a category
  const handleEditCategory = (originalCategory: string) => {
    setEditingCategory({
      original: originalCategory,
      new: originalCategory,
    });
  };

  // Save edited category
  const handleSaveEditedCategory = async () => {
    if (!editingCategory) {
      return;
    }

    if (!editingCategory.new.trim()) {
      toast.error('Category name is required');

      return;
    }

    if (editingCategory.original !== editingCategory.new && categories.includes(editingCategory.new.trim())) {
      toast.error('Category already exists');

      return;
    }

    try {
      // Update all prompts with the old category to use the new category
      const prompts = await PromptLibrary.getCustomPrompts();

      await Promise.all(
        prompts.map(async (prompt: CustomPrompt) => {
          if (prompt.category === editingCategory.original) {
            await PromptLibrary.updateCustomPrompt(prompt.id, {
              ...prompt,
              category: editingCategory.new.trim(),
            });
          }
        }),
      );

      setEditingCategory(null);
      await loadPrompts();
    } catch (_error) {
      console.error('Error updating category:', _error);
      toast.error('Failed to update category');

      return;
    }
  };

  // Handle deleting a category
  const handleDeleteCategory = async (categoryToDelete: string) => {
    // Confirm before deleting
    if (
      !window.confirm(
        `Are you sure you want to delete the category "${categoryToDelete}"? \nItems will not be deleted but will lose this category.`,
      )
    ) {
      return;
    }

    try {
      // Find all prompts with this category and update them to "Custom"
      const prompts = await PromptLibrary.getCustomPrompts();
      let updatedCount = 0;

      await Promise.all(
        prompts.map(async (prompt: CustomPrompt) => {
          if (prompt.category === categoryToDelete) {
            await PromptLibrary.updateCustomPrompt(prompt.id, {
              ...prompt,
              category: 'Custom',
            });
            updatedCount++;
          }
        }),
      );

      logStore.logSystem(`Deleted category: ${categoryToDelete} (${updatedCount} items updated)`);
      toast.success(
        `Category deleted successfully. ${updatedCount} ${updatedCount === 1 ? 'item' : 'items'} moved to "Custom" category.`,
      );

      if (activeCategory === categoryToDelete) {
        setActiveCategory(null);
      }

      await loadPrompts();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  // Handle adding item
  const handleAddItem = async () => {
    try {
      if (!formData.label.trim()) {
        toast.error('Item name is required');
        return;
      }

      if (!formData.content.trim()) {
        toast.error('Item content is required');
        return;
      }

      const category = formData.category === 'custom' ? customCategory : formData.category;

      if (formData.category === 'custom' && !customCategory.trim()) {
        toast.error('Category name is required');
        return;
      }

      const newPromptData = await PromptLibrary.addCustomPrompt({
        label: formData.label.trim(),
        description: formData.description.trim() || 'No description provided',
        content: formData.content.trim(),
        category: category.trim(),
        id: activeTab === 'rules' ? `rule_${Date.now()}` : undefined,
      });

      logStore.logSystem(`Added new item: ${newPromptData.label}`);

      setFormData({
        label: '',
        description: '',
        content: '',
        category: 'Custom',
      });
      setCustomCategory('');
      setShowAddDialog(false);
      await loadPrompts();
      toast.success('Item added successfully');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (!deletePromptId) {
        return;
      }

      const promptToDelete = customPrompts.find((p) => p.id === deletePromptId);

      if (!promptToDelete) {
        toast.error('Item not found');
        return;
      }

      if (deletePromptId === promptId) {
        setPromptId('default');
        toast.info('Switched to default item as the current one was deleted');
      }

      await PromptLibrary.deleteCustomPrompt(deletePromptId);
      logStore.logSystem(`Deleted item: ${promptToDelete.label}`);

      setDeletePromptId(null);
      setShowDeleteDialog(false);
      await loadPrompts(); // Reload prompts after deletion

      const itemType = promptToDelete.id.startsWith('rule_') ? 'Rule' : 'Prompt';
      toast.success(`${itemType} deleted: ${promptToDelete.label}`);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleTogglePromptState = async (id: string) => {
    try {
      // Eğer bu bir sistem promptuysa değiştirilmesine izin verme
      const isSystemPrompt = systemPrompts.some((p) => p.id === id);

      if (isSystemPrompt) {
        toast.info('System prompts are always active and cannot be deactivated.');
        return;
      }

      const newState = !promptStates[id];

      // Update the state in IndexedDB
      await PromptLibrary.setPromptStatus(id, newState);

      // Update local state
      setPromptStates((prev) => {
        const newStates = { ...prev, [id]: newState };

        if (newState) {
          setActivePrompts([...activePrompts, id]);
          toast.success('Item activated successfully');
        } else {
          setActivePrompts(activePrompts.filter((promptId) => promptId !== id));
          toast.success('Item deactivated successfully');
        }

        return newStates;
      });
    } catch (error) {
      console.error('Error toggling prompt state:', error);
      toast.error('Failed to update item status');
    }
  };

  // Handle editing prompt
  const handleEditPrompt = async () => {
    try {
      if (!selectedPrompt) {
        return;
      }

      if (!editFormData.label.trim()) {
        toast.error('Item name is required');
        return;
      }

      if (!editFormData.content.trim()) {
        toast.error('Item content is required');
        return;
      }

      await PromptLibrary.updateCustomPrompt(selectedPrompt.id, {
        label: editFormData.label.trim(),
        description: editFormData.description.trim() || 'No description provided',
        content: editFormData.content.trim(),
        category: editFormData.category.trim(),
      });

      logStore.logSystem(`Updated item: ${editFormData.label}`);

      setIsEditing(false);
      setShowViewDialog(false);
      await loadPrompts(); // Reload prompts after update

      const itemType = selectedPrompt.id.startsWith('rule_') ? 'Rule' : 'Prompt';
      toast.success(`${itemType} updated: ${editFormData.label}`);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  // Initialize edit form when a prompt is selected
  useEffect(() => {
    if (selectedPrompt) {
      setEditFormData({
        label: selectedPrompt.label || '',
        description: selectedPrompt.description || '',
        content: selectedPrompt.content || '',
        category: selectedPrompt.category || 'Custom',
      });
    }
  }, [selectedPrompt]);

  const filteredPrompts = getFilteredPrompts();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        {/* Tab Buttons */}
        <div className="flex space-x-2">
          <button
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              activeTab === 'prompts'
                ? 'bg-purple-500 text-white shadow-sm hover:bg-purple-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:border-[#333] dark:bg-[#1A1A1A] dark:text-gray-300 dark:hover:bg-[#252525]',
            )}
            onClick={() => setActiveTab('prompts')}
          >
            <div className="flex items-center gap-1.5">
              <div className="i-ph:book-open w-4 h-4" />
              Prompts
            </div>
          </button>
          <button
            className={classNames(
              'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200',
              activeTab === 'rules'
                ? 'bg-purple-500 text-white shadow-sm hover:bg-purple-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:border-[#333] dark:bg-[#1A1A1A] dark:text-gray-300 dark:hover:bg-[#252525]',
            )}
            onClick={() => setActiveTab('rules')}
          >
            <div className="flex items-center gap-1.5">
              <div className="i-ph:ruler w-4 h-4" />
              Rules
            </div>
          </button>
        </div>
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            onClick={() => setShowAddDialog(true)}
          >
            Add New
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            onClick={() => setShowImportDialog(true)}
          >
            Import from URL
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md shadow-sm border border-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30 dark:bg-[#1A1A1A] dark:text-gray-300 dark:border-[#333] dark:hover:bg-[#252525]"
            onClick={() => setShowCategoryModal(true)}
          >
            Manage Categories
          </button>
        </div>
      </div>

      {/* Prompt Library Content */}
      <div role="tabpanel" className="focus:outline-none bg-transparent">
        <div className="bg-transparent">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-transparent"
          >
            {/* Prompts/Rules Table */}
            <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-[#333] bg-transparent dark:bg-transparent mt-4">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#1A1A1A]/50">
                <div className="flex items-center gap-2">
                  <div className="i-ph:info w-4 h-4 text-purple-500" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You can select multiple {activeTab === 'prompts' ? 'prompts' : 'rules'} to use in your workspace.
                    Use the toggles to activate or deactivate them.
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-blue-50/50 dark:bg-blue-900/10">
                <div className="flex items-center gap-2">
                  <div className="i-ph:lock-simple-fill w-4 h-4 text-red-500" />
                  <p className="text-sm text-gray-800 dark:text-gray-300">
                    <span className="font-medium">Note:</span> System prompts are active by default and cannot be
                    deactivated. They are essential for the proper functioning of the application.
                  </p>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="bg-transparent dark:bg-transparent border-b border-gray-200 dark:border-[#333]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                      Select
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#333]">
                  {/* Filter to show only prompts or rules based on the active tab */}
                  {[...filteredPrompts.system, ...filteredPrompts.custom]
                    .filter((item) => {
                      // Check if the item should be shown in the current tab
                      const isRule = item.id.startsWith('rule_');
                      return activeTab === 'rules' ? isRule : !isRule;
                    })
                    .map((prompt) => (
                      <tr
                        key={prompt.id}
                        className="bg-transparent dark:bg-transparent hover:bg-gray-50/30 dark:hover:bg-[#1A1A1A]/30 transition-colors duration-200"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={classNames(
                                'w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200',
                                'bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333]',
                                promptStates[prompt.id] ? 'text-purple-500' : 'text-gray-500 dark:text-gray-400',
                              )}
                            >
                              {prompt.id in systemPrompts ? (
                                <div className="i-ph:gear-fill w-4 h-4" />
                              ) : (
                                <div className="i-ph:book-open-text w-4 h-4" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{prompt.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{prompt.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {prompt.description}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {!prompt.isSystem && (
                              <button
                                onClick={() => {
                                  setDeletePromptId(prompt.id);
                                  setShowDeleteDialog(true);
                                }}
                                className={classNames(
                                  'p-1.5 rounded-lg transition-all duration-200',
                                  'text-gray-400 dark:text-red-500/50',
                                  'hover:text-red-500 dark:hover:text-red-500',
                                  'hover:bg-red-500/10 dark:hover:bg-red-950',
                                )}
                                title="Delete"
                              >
                                <div className="i-ph:trash w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedPrompt(prompt as CustomPrompt);
                                setShowViewDialog(true);
                              }}
                              className={classNames(
                                'p-1.5 rounded-lg transition-all duration-200',
                                'text-gray-400 dark:text-purple-500/50',
                                'hover:text-purple-500 dark:hover:text-purple-400',
                                'hover:bg-purple-500/10 dark:hover:bg-purple-950',
                              )}
                              title="View"
                            >
                              <div className="i-ph:eye w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {prompt.isSystem ? (
                              <div
                                className="flex items-center justify-center w-10 h-6 rounded-full bg-red-500/10 text-red-500 cursor-default"
                                title="This system prompt is always active and cannot be modified"
                              >
                                <div className="i-ph:lock-simple-fill w-4 h-4" />
                              </div>
                            ) : (
                              <Switch
                                checked={promptStates[prompt.id] || false}
                                onCheckedChange={() => handleTogglePromptState(prompt.id)}
                                className={classNames(
                                  'data-[state=checked]:bg-purple-500',
                                  'dark:bg-[#333] dark:data-[state=checked]:bg-purple-500',
                                )}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Add Prompt Dialog */}
      <DialogRoot open={showAddDialog} onOpenChange={setShowAddDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:book-open-text w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit' : 'Add New'} {activeTab === 'prompts' ? 'Prompt' : 'Rule'}
              </DialogTitle>
            </div>

            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              {isEditing
                ? `Modify this ${activeTab === 'prompts' ? 'prompt' : 'rule'} and save your changes.`
                : `Create a custom ${activeTab === 'prompts' ? 'prompt' : 'rule'} that will be available in your collection.`}
            </DialogDescription>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="E.g., Technical Assistant"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="E.g., Specialized for technical documentation and explanations"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                {/* Category selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="Custom">Custom</option>
                      <option value="custom">Add new category...</option>
                    </select>
                  </div>

                  {formData.category === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Category Name
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="E.g., Data Science"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    </div>
                  )}
                </div>

                {/* Prompt Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {activeTab === 'prompts' ? 'Prompt' : 'Rule'} Content
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder={`Enter your ${activeTab === 'prompts' ? 'prompt' : 'rule'} text here...`}
                      rows={10}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              <DialogButton type="secondary" onClick={() => setShowAddDialog(false)}>
                Cancel
              </DialogButton>
              <DialogButton type="primary" onClick={handleAddItem}>
                {isEditing ? 'Save Changes' : 'Add Item'}
              </DialogButton>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* View/Edit Dialog */}
      <DialogRoot open={showViewDialog} onOpenChange={setShowViewDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:book-open-text w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Item' : 'View Item'}
              </DialogTitle>
            </div>

            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              {isEditing ? 'Edit the details of your item' : 'View the details of your item'}
            </DialogDescription>

            {selectedPrompt && (
              <div className="space-y-6">
                {isEditing ? (
                  // Edit mode
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                        <input
                          type="text"
                          value={editFormData.label}
                          onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Category
                        </label>
                        <select
                          value={editFormData.category}
                          onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Content
                        </label>
                        <div className="relative">
                          <textarea
                            value={editFormData.content}
                            onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                            rows={12}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                          />
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  // View mode
                  <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</h3>
                        <p className="text-base text-gray-900 dark:text-white">{selectedPrompt.label}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</h3>
                        <p className="text-base text-gray-900 dark:text-white">{selectedPrompt.description}</p>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Category</h3>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                            {selectedPrompt.category}
                          </span>
                          {selectedPrompt.isSystem && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              System
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Content</h3>
                        <div className="bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md p-3 overflow-auto">
                          {selectedPrompt?.isSystem ? (
                            <div className="text-sm text-gray-700 dark:text-gray-300 italic">
                              This is a system prompt. Its content is dynamically generated and cannot be directly
                              viewed.
                            </div>
                          ) : (
                            <pre className="text-sm text-gray-900 dark:text-white font-mono whitespace-pre-wrap">
                              {selectedPrompt?.content}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
                  {isEditing ? (
                    <>
                      <DialogButton
                        type="secondary"
                        onClick={() => {
                          setIsEditing(false);
                          setShowViewDialog(false);
                        }}
                      >
                        Cancel
                      </DialogButton>
                      <DialogButton type="primary" onClick={handleEditPrompt}>
                        Save Changes
                      </DialogButton>
                    </>
                  ) : (
                    <>
                      <DialogButton
                        type="secondary"
                        onClick={() => {
                          setIsEditing(false);
                          setShowViewDialog(false);
                        }}
                      >
                        Close
                      </DialogButton>
                      {selectedPrompt && !selectedPrompt.isSystem && (
                        <DialogButton type="primary" onClick={() => setIsEditing(true)}>
                          Edit Item
                        </DialogButton>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <Dialog className="max-w-md">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:warning-circle-fill w-6 h-6 text-red-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Confirm Deletion
              </DialogTitle>
            </div>

            <DialogDescription className="mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              <DialogButton
                type="secondary"
                onClick={() => {
                  setDeletePromptId(null);
                  setShowDeleteDialog(false);
                }}
              >
                Cancel
              </DialogButton>
              <DialogButton type="danger" onClick={handleConfirmDelete}>
                Delete Item
              </DialogButton>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Category Management Modal */}
      <DialogRoot open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <Dialog className="max-w-xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:folders w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                Category Management
              </DialogTitle>
            </div>

            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              Manage categories to better organize your collection.
            </DialogDescription>

            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Category List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Categories</h3>
                    <button
                      className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200 flex items-center gap-1 text-xs focus:outline-none"
                      onClick={() => {
                        setShowAddCategoryForm(true);
                        setCustomCategory('');
                      }}
                    >
                      <div className="i-ph:plus w-3 h-3" />
                      Category
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                    {categories.map((category) => (
                      <div
                        key={category}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#151515]"
                      >
                        {editingCategory && editingCategory.original === category ? (
                          <input
                            type="text"
                            value={editingCategory.new}
                            onChange={(e) => setEditingCategory({ ...editingCategory, new: e.target.value })}
                            className="flex-1 px-2 py-1 bg-white dark:bg-[#1A1A1A] border border-purple-200 dark:border-purple-900/50 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-sm mr-2"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditedCategory();
                              } else if (e.key === 'Escape') {
                                setEditingCategory(null);
                              }
                            }}
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{category}</span>
                        )}

                        <div className="flex items-center gap-2">
                          {editingCategory && editingCategory.original === category ? (
                            <>
                              <button
                                className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 text-green-500 transition-colors duration-200"
                                title="Save"
                                onClick={handleSaveEditedCategory}
                              >
                                <div className="i-ph:check w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252525] text-gray-500 dark:text-gray-400 transition-colors duration-200"
                                title="Cancel"
                                onClick={() => setEditingCategory(null)}
                              >
                                <div className="i-ph:x w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Sistem kategorileri düzenlenemiyor ve silinemiyor */}
                              {!['Development', 'Writing', 'Business', 'Education', 'Custom'].includes(category) && (
                                <>
                                  <button
                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252525] text-gray-500 dark:text-gray-400 transition-colors duration-200"
                                    title="Edit"
                                    onClick={() => handleEditCategory(category)}
                                  >
                                    <div className="i-ph:pencil-simple w-4 h-4" />
                                  </button>
                                  <button
                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors duration-200"
                                    title="Delete"
                                    onClick={() => handleDeleteCategory(category)}
                                  >
                                    <div className="i-ph:trash w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Yeni Kategori Ekle */}
                {showAddCategoryForm && (
                  <div className="pt-4 border-t border-gray-200 dark:border-[#333]">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Category</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="New category name..."
                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddCategory();
                          } else if (e.key === 'Escape') {
                            setShowAddCategoryForm(false);
                          }
                        }}
                      />
                      <button
                        className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200 flex items-center gap-1 text-sm focus:outline-none"
                        onClick={handleAddCategory}
                      >
                        <div className="i-ph:plus w-4 h-4" />
                        Add
                      </button>
                      <button
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#151515] dark:hover:bg-[#252525] text-gray-700 dark:text-gray-300 rounded-md transition-colors duration-200 flex items-center gap-1 text-sm focus:outline-none"
                        onClick={() => setShowAddCategoryForm(false)}
                      >
                        <div className="i-ph:x w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              <DialogButton type="secondary" onClick={() => setShowCategoryModal(false)}>
                Close
              </DialogButton>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Add this new Dialog for URL import */}
      <DialogRoot open={showImportDialog} onOpenChange={setShowImportDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:link w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">Import from URL</DialogTitle>
            </div>

            {/* Import Form */}
            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              Import prompts or rules from a URL. Supports various formats including text, JSON, CSV, and HTML.
            </DialogDescription>

            <div className="mt-4">
              <UrlImportForm
                onClose={() => setShowImportDialog(false)}
                defaultType={activeTab === 'prompts' ? 'prompt' : 'rules'}
              />
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    </div>
  );
}
