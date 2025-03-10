// Remove unused imports (Updated to fix Vite import resolution issues)
import React, { memo, useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary, type CustomPrompt } from '~/lib/common/prompt-library';
import { ScrollArea } from '~/components/ui/ScrollArea';

interface FeatureToggle {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  beta?: boolean;
  experimental?: boolean;
  tooltip?: string;
}

const FeatureCard = memo(
  ({
    feature,
    index,
    onToggle,
  }: {
    feature: FeatureToggle;
    index: number;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      key={feature.id}
      layoutId={feature.id}
      className={classNames(
        'relative group cursor-pointer',
        'bg-bolt-elements-background-depth-2',
        'hover:bg-bolt-elements-background-depth-3',
        'transition-colors duration-200',
        'rounded-lg overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(feature.icon, 'w-5 h-5 text-bolt-elements-textSecondary')} />
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-bolt-elements-textPrimary">{feature.title}</h4>
              {feature.beta && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 font-medium">Beta</span>
              )}
              {feature.experimental && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 font-medium">
                  Experimental
                </span>
              )}
            </div>
          </div>
          <Switch checked={feature.enabled} onCheckedChange={(checked) => onToggle(feature.id, checked)} />
        </div>
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">{feature.description}</p>
        {feature.tooltip && <p className="mt-1 text-xs text-bolt-elements-textTertiary">{feature.tooltip}</p>}
      </div>
    </motion.div>
  ),
);

const FeatureSection = memo(
  ({
    title,
    features,
    icon,
    description,
    onToggleFeature,
  }: {
    title: string;
    features: FeatureToggle[];
    icon: string;
    description: string;
    onToggleFeature: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      layout
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className={classNames(icon, 'text-xl text-purple-500')} />
        <div>
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
          <p className="text-sm text-bolt-elements-textSecondary">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} onToggle={onToggleFeature} />
        ))}
      </div>
    </motion.div>
  ),
);

// Yardımcı fonksiyonlar
const isClient = typeof window !== 'undefined';

// Helper function to safely access localStorage
function getFromLocalStorage(key: string, defaultValue: any = null) {
  if (!isClient) return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

// Helper function to safely set localStorage
function setToLocalStorage(key: string, value: any) {
  if (!isClient) return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
}

export default function FeaturesTab() {
  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setPromptId,
    promptId,
  } = useSettings();
  
  // Add new setting for selected rules
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const storageKey = 'bolt_selected_rules';

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false);
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true);
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true);
    }

    if (promptId === undefined) {
      setPromptId('default');
    }

    if (eventLogs === undefined) {
      setEventLogs(true);
    }

    // Load selected rules from localStorage
    const storedRules = getFromLocalStorage(storageKey);
    if (storedRules) {
      setSelectedRules(storedRules);
    }
  }, []);

  const handleToggleFeature = useCallback(
    (id: string, enabled: boolean) => {
      switch (id) {
        case 'latestBranch': {
          enableLatestBranch(enabled);
          toast.success(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoSelectTemplate': {
          setAutoSelectTemplate(enabled);
          toast.success(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'contextOptimization': {
          enableContextOptimization(enabled);
          toast.success(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'eventLogs': {
          setEventLogs(enabled);
          toast.success(`Event logging ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        default:
          break;
      }
    },
    [enableLatestBranch, setAutoSelectTemplate, enableContextOptimization, setEventLogs],
  );

  const features = {
    stable: [
      {
        id: 'latestBranch',
        title: 'Main Branch Updates',
        description: 'Get the latest updates from the main branch',
        icon: 'i-ph:git-branch',
        enabled: isLatestBranch,
        tooltip: 'Enabled by default to receive updates from the main development branch',
      },
      {
        id: 'autoSelectTemplate',
        title: 'Auto Select Template',
        description: 'Automatically select starter template',
        icon: 'i-ph:selection',
        enabled: autoSelectTemplate,
        tooltip: 'Enabled by default to automatically select the most appropriate starter template',
      },
      {
        id: 'contextOptimization',
        title: 'Context Optimization',
        description: 'Optimize context for better responses',
        icon: 'i-ph:brain',
        enabled: contextOptimizationEnabled,
        tooltip: 'Enabled by default for improved AI responses',
      },
      {
        id: 'eventLogs',
        title: 'Event Logging',
        description: 'Enable detailed event logging and history',
        icon: 'i-ph:list-bullets',
        enabled: eventLogs,
        tooltip: 'Enabled by default to record detailed logs of system events and user actions',
      },
    ],
    beta: [],
  };

  // State for prompts and rules data
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [rules, setRules] = useState<CustomPrompt[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load prompts and rules
  useEffect(() => {
    function loadData() {
      try {
        setLoading(true);
        
        // Sync API'leri kullanarak verileri yükle
        const promptsData = PromptLibrary.getCustomPromptsSync();
        const rulesData = PromptLibrary.getRulesSync();
        
        setPrompts(promptsData);
        setRules(rulesData);
        
        // Initialize selectedItems with promptId and stored rules
        const initialSelected = [];
        if (promptId) {
          initialSelected.push(promptId);
        }
        
        // selectedRules state'i değiştiğinde useEffect tetiklenmesin diye local değişken kullan
        const storedRules = getFromLocalStorage(storageKey, []);
        initialSelected.push(...storedRules);
        
        setSelectedItems(initialSelected);
      } catch (error) {
        console.error('Error loading prompts and rules:', error);
        toast.error('Failed to load prompts and rules');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    
    // Initialize PromptLibrary (ancak yükleme işlemlerini beklemiyoruz)
    PromptLibrary.initialize().catch(error => {
      console.error('Error initializing PromptLibrary:', error);
    });
  }, [promptId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle selection of an item
  const handleSelect = (id: string) => {
    let newSelected: string[];
    
    if (selectedItems.includes(id)) {
      // Remove if already selected
      newSelected = selectedItems.filter(item => item !== id);
    } else {
      // Add to selection
      newSelected = [...selectedItems, id];
    }
    
    setSelectedItems(newSelected);
    
    try {
      // Find the selected item using sync API
      const item = PromptLibrary.getByIdSync(id);
      
      if (!item) {
        console.error('Item not found:', id);
        return;
      }
      
      if (item.isRule) {
        // Handle rule selection - update selected rules
        const updatedRules = newSelected.filter(selectedId => 
          rules.some(r => r.id === selectedId)
        );
        
        setSelectedRules(updatedRules);
        setToLocalStorage(storageKey, updatedRules);
        
        toast.success(`Rule ${selectedItems.includes(id) ? 'removed' : 'applied'}`);
      } else {
        // Handle prompt selection - update prompt ID
        setPromptId(id);
        toast.success(`Prompt "${item.label}" selected`);
      }
    } catch (error) {
      console.error('Error handling selection:', error);
      toast.error('Failed to update selection');
    }
  };

  // Filter items based on search
  const filteredItems = React.useMemo(() => {
    if (!searchText) {
      return { prompts, rules };
    }
    
    const searchLower = searchText.toLowerCase();
    
    return {
      prompts: prompts.filter(item => 
        item.label.toLowerCase().includes(searchLower) || 
        (item.description && item.description.toLowerCase().includes(searchLower))
      ),
      rules: rules.filter(item => 
        item.label.toLowerCase().includes(searchLower) || 
        (item.description && item.description.toLowerCase().includes(searchLower))
      )
    };
  }, [prompts, rules, searchText]);

  return (
    <div className="flex flex-col gap-8">
      <FeatureSection
        title="Core Features"
        features={features.stable}
        icon="i-ph:check-circle"
        description="Essential features that are enabled by default for optimal performance"
        onToggleFeature={handleToggleFeature}
      />

      {features.beta.length > 0 && (
        <FeatureSection
          title="Beta Features"
          features={features.beta}
          icon="i-ph:test-tube"
          description="New features that are ready for testing but may have some rough edges"
          onToggleFeature={handleToggleFeature}
        />
      )}

      <motion.div
        className="group"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-start gap-3">
          <div
            className={classNames(
              'p-1.5 rounded-lg text-lg mt-1',
              'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
              'transition-colors duration-200',
              'text-purple-500',
            )}
          >
            <div className="i-ph:book-open-text" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 transition-colors">
                Prompt Library & Rules
              </h4>
            </div>
            <p className="text-xs text-bolt-elements-textSecondary mt-0.5 mb-2">
              Choose prompts and rules from the library to customize AI behavior
            </p>
            
            {/* Enhanced MultiSelect component */}
            <div ref={dropdownRef} className="relative mb-4">
              <div className="mb-1 text-xs font-medium text-bolt-elements-textPrimary">Prompts & Rules</div>
              <div 
                onClick={() => setShowOptions(!showOptions)}
                className={classNames(
                  'p-2 rounded border cursor-pointer flex items-center justify-between',
                  'bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary text-sm min-h-[36px]',
                  'hover:border-purple-500/30 transition-all duration-200',
                  showOptions ? 'border-purple-500/50 ring-1 ring-purple-500/20' : ''
                )}
              >
                {loading ? (
                  <div className="flex items-center justify-center w-full py-1">
                    <div className="animate-spin rounded-full border-2 border-t-transparent w-4 h-4 border-2 border-purple-500" />
                    <span className="ml-2 text-bolt-elements-textSecondary">Loading...</span>
                  </div>
                ) : selectedItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedItems.map(id => {
                      const promptItem = prompts.find(p => p.id === id);
                      const ruleItem = rules.find(r => r.id === id);
                      const item = promptItem || ruleItem;
                      
                      if (!item) return null;
                      
                      return (
                        <div key={id} className={classNames(
                          "flex items-center rounded px-2 py-0.5 border text-xs",
                          item.isRule 
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-500 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-400" 
                            : "bg-purple-500/10 border-purple-500/20 text-purple-500 dark:bg-purple-500/20 dark:border-purple-500/30 dark:text-purple-400"
                        )}>
                          <div className={classNames(
                            "mr-1 text-xs",
                            item.isRule ? "i-ph:file-text" : "i-ph:book-open-text"
                          )} />
                          <span className="truncate max-w-[150px]">{item.label}</span>
                          <button 
                            className="ml-1 opacity-70 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(id);
                            }}
                          >
                            <div className="i-ph:x-circle text-xs" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-bolt-elements-textTertiary text-sm">Select prompts and rules</div>
                )}
                <div className={classNames(
                  "ml-2 flex-shrink-0",
                  showOptions ? "i-ph:caret-up" : "i-ph:caret-down"
                )} />
              </div>
              
              {showOptions && (
                <div className="absolute z-10 w-full mt-1 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded overflow-hidden shadow-lg">
                  <div className="p-2 border-b border-bolt-elements-borderColor">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                        <div className="i-ph:magnifying-glass text-xs text-bolt-elements-textTertiary" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-purple-500/30"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto">
                    {/* Prompts Section */}
                    <div>
                      <div className="px-3 py-2 text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
                        <div className="flex items-center">
                          <div className="i-ph:book-open-text text-xs mr-1.5" />
                          Prompts
                          <span className="ml-2 text-xs text-bolt-elements-textSecondary font-normal">
                            (Choose one prompt)
                          </span>
                        </div>
                      </div>
                      
                      {filteredItems.prompts.length > 0 ? (
                        <div>
                          {filteredItems.prompts.map((item) => (
                            <div
                              key={item.id}
                              className={classNames(
                                'px-3 py-2 flex items-center gap-2 cursor-pointer',
                                'text-sm hover:bg-bolt-elements-background-depth-2',
                                selectedItems.includes(item.id) ? 'bg-purple-500/20 dark:bg-purple-500/30' : ''
                              )}
                              onClick={() => handleSelect(item.id)}
                            >
                              <div className={classNames(
                                'w-4 h-4 flex-shrink-0 border rounded-full',
                                selectedItems.includes(item.id) ? 
                                  'bg-purple-500 border-purple-500 flex items-center justify-center' : 
                                  'border-bolt-elements-borderColor'
                              )}>
                                {selectedItems.includes(item.id) && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-bolt-elements-textPrimary truncate">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-bolt-elements-textSecondary truncate">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.version && (
                                <div className="text-xs text-bolt-elements-textTertiary">v{item.version}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-sm text-center text-bolt-elements-textTertiary">
                          No prompts found
                        </div>
                      )}
                    </div>
                    
                    {/* Rules Section */}
                    <div>
                      <div className="px-3 py-2 text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
                        <div className="flex items-center">
                          <div className="i-ph:file-text text-xs mr-1.5" />
                          Rules
                          <span className="ml-2 text-xs text-bolt-elements-textSecondary font-normal">
                            (Select multiple rules)
                          </span>
                        </div>
                      </div>
                      
                      {filteredItems.rules.length > 0 ? (
                        <div>
                          {filteredItems.rules.map((item) => (
                            <div
                              key={item.id}
                              className={classNames(
                                'px-3 py-2 flex items-center gap-2 cursor-pointer',
                                'text-sm hover:bg-bolt-elements-background-depth-2',
                                selectedItems.includes(item.id) ? 'bg-blue-500/20 dark:bg-blue-500/30' : ''
                              )}
                              onClick={() => handleSelect(item.id)}
                            >
                              <div className={classNames(
                                'w-4 h-4 flex-shrink-0 border rounded',
                                selectedItems.includes(item.id) ? 
                                  'bg-blue-500 border-blue-500 flex items-center justify-center' : 
                                  'border-bolt-elements-borderColor'
                              )}>
                                {selectedItems.includes(item.id) && <div className="i-ph:check text-white text-xs" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-bolt-elements-textPrimary truncate">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <div className="text-xs text-bolt-elements-textSecondary truncate">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {item.priority && (
                                <div className="text-xs px-1.5 py-0.5 rounded-full bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary">
                                  P{item.priority}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-sm text-center text-bolt-elements-textTertiary">
                          No rules found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected Items Summary */}
            {selectedItems.length > 0 && (
              <div className="mt-2 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-3">
                <h5 className="text-xs font-medium text-bolt-elements-textPrimary mb-2">Active Configuration</h5>
                
                {prompts.filter(p => selectedItems.includes(p.id)).map(prompt => (
                  <div key={prompt.id} className="mb-2">
                    <div className="flex items-center gap-1 text-purple-500 dark:text-purple-400 text-sm">
                      <div className="i-ph:book-open-text text-xs" />
                      <span className="font-medium">Active Prompt:</span>
                      <span>{prompt.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-bolt-elements-textSecondary">
                      {prompt.description}
                    </div>
                  </div>
                ))}
                
                {rules.filter(r => selectedItems.includes(r.id)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400 text-sm mt-3">
                      <div className="i-ph:file-text text-xs" />
                      <span className="font-medium">Active Rules:</span>
                      <span>{rules.filter(r => selectedItems.includes(r.id)).length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      {rules.filter(r => selectedItems.includes(r.id))
                        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                        .map(rule => (
                        <div key={rule.id} className="flex items-center text-xs">
                          <div className="i-ph:check-circle text-green-500 mr-1" />
                          <span className="text-bolt-elements-textPrimary truncate">{rule.label}</span>
                          {rule.priority && (
                            <span className="ml-1 text-xs text-bolt-elements-textTertiary">(P{rule.priority})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
