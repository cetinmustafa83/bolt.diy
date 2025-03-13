import React, { memo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';
import Select from 'react-select';
import type { StylesConfig, MultiValue } from 'react-select';
import { components } from 'react-select';

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

interface PromptOption {
  value: string;
  label: string;
  description?: string;
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
    activePrompts,
    setActivePrompts,
  } = useSettings();

  // Convert library prompts to options format
  const [allPromptOptions, setAllPromptOptions] = useState<PromptOption[]>([]);

  // Initialize system prompts
  const systemPromptOptions = React.useMemo(
    () =>
      Object.entries(PromptLibrary.library).map(([id, prompt]) => ({
        value: id,
        label: prompt.label,
        description: prompt.description,
      })),
    [],
  );

  // Load custom prompts
  useEffect(() => {
    const loadCustomPrompts = async () => {
      try {
        const customPrompts = await PromptLibrary.getCustomPrompts();
        const customPromptOptions = customPrompts.map((prompt) => ({
          value: prompt.id,
          label: prompt.label,
          description: prompt.description,
        }));
        setAllPromptOptions([...systemPromptOptions, ...customPromptOptions]);
      } catch (error) {
        console.error('Error loading custom prompts:', error);
        setAllPromptOptions(systemPromptOptions);
      }
    };

    loadCustomPrompts();
  }, [systemPromptOptions]);

  // Selected values for multi-select
  const selectedValues = React.useMemo(
    () => allPromptOptions.filter((option) => activePrompts.includes(option.value)),
    [allPromptOptions, activePrompts],
  );

  // Handle prompt selection
  const handlePromptChange = async (newValue: MultiValue<PromptOption>, _actionMeta: any) => {
    try {
      const newSelectedIds = newValue.map((item) => item.value);

      // Find which prompts were added and removed
      const added = newSelectedIds.filter((id) => !activePrompts.includes(id));
      const removed = activePrompts.filter((id) => !newSelectedIds.includes(id));

      // Update status for added prompts
      for (const id of added) {
        try {
          await PromptLibrary.setPromptStatus(id, true);
        } catch (err) {
          const error = err as Error;
          console.error(`Failed to activate prompt ${id}:`, error);

          /*
           * Update the UI state anyway to prevent UI from getting out of sync
           * This way the UI will reflect the user's action even if the backend fails
           */
          continue;
        }
      }

      // Update status for removed prompts
      for (const id of removed) {
        try {
          await PromptLibrary.setPromptStatus(id, false);
        } catch (err) {
          const error = err as Error;
          console.error(`Failed to deactivate prompt ${id}:`, error);

          // Continue with UI update despite backend error
          continue;
        }
      }

      // Update UI state regardless of backend status
      setActivePrompts(newSelectedIds);

      if (added.length > 0) {
        toast.success(`${added.length} prompt${added.length === 1 ? '' : 's'} activated`);
      }

      if (removed.length > 0) {
        toast.success(`${removed.length} prompt${removed.length === 1 ? '' : 's'} deactivated`);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error updating prompt status:', error);
      toast.error(`Failed to update prompt status: ${error?.message || 'Unknown error'}`);
    }
  };

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false); // Default: OFF - Don't auto-update from main branch
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true); // Default: ON - Enable context optimization
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true); // Default: ON - Enable auto-select templates
    }

    if (promptId === undefined) {
      setPromptId('default'); // Default: 'default'
    }

    if (eventLogs === undefined) {
      setEventLogs(true); // Default: ON - Enable event logging
    }
  }, []); // Only run once on component mount

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

  const selectStyles: StylesConfig<PromptOption, true> = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'var(--bolt-elements-background-depth-2)',
      borderColor: state.isFocused ? 'var(--bolt-purple-400)' : 'var(--bolt-elements-borderColor)',
      boxShadow: state.isFocused ? '0 0 0 2px var(--bolt-purple-500-20)' : 'none',
      '&:hover': {
        borderColor: 'var(--bolt-purple-300)',
        backgroundColor: 'var(--bolt-elements-background-depth-3)',
      },
      borderRadius: '0.5rem',
      padding: '2px 4px',
      transition: 'all 200ms ease',
      minHeight: '40px',
      border: '1px solid var(--bolt-elements-borderColor)',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--bolt-elements-background-depth-1)',
      border: '1px solid var(--bolt-elements-borderColor)',
      boxShadow: 'var(--bolt-elements-shadow-md)',
      overflow: 'hidden',
      zIndex: 50,
      borderRadius: '0.5rem',
      marginTop: '4px',
      padding: '2px',
    }),
    menuList: (base) => ({
      ...base,
      padding: '6px',
      backgroundColor: 'var(--bolt-elements-background-depth-1)',
      '&::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'var(--bolt-elements-background-depth-2)',
        borderRadius: '4px',
      },
      '&::-webkit-scrollbar-thumb': {
        background: 'var(--bolt-purple-400-20)',
        borderRadius: '4px',
        '&:hover': {
          background: 'var(--bolt-purple-400-30)',
        },
      },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? 'var(--bolt-purple-500-15)'
        : state.isSelected
          ? 'var(--bolt-purple-500-25)'
          : 'var(--bolt-elements-background-depth-2)',
      color: state.isSelected ? 'var(--bolt-purple-300)' : 'var(--bolt-elements-textPrimary)',
      padding: '8px 12px',
      borderRadius: '0.375rem',
      cursor: 'pointer',
      fontSize: '0.875rem',
      fontWeight: 500,
      marginBottom: '2px',
      '&:active': {
        backgroundColor: 'var(--bolt-purple-500-30)',
      },
      '&:hover': {
        backgroundColor: 'var(--bolt-purple-400-20)',
        color: 'var(--bolt-purple-300)',
        borderColor: 'var(--bolt-purple-300)',
      },
      transition: 'all 150ms ease',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'var(--bolt-purple-500-10)',
      borderRadius: '0.375rem',
      border: '1px solid var(--bolt-purple-400-40)',
      padding: '1px 2px',
      margin: '2px',
      boxShadow: 'var(--bolt-elements-shadow-sm)',
      '&:hover': {
        backgroundColor: 'var(--bolt-purple-400-15)',
        border: '1px solid var(--bolt-purple-300)',
      },
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'var(--bolt-purple-700)',
      backgroundColor: 'transparent',
      padding: '2px 6px 2px 2px',
      fontSize: '0.875rem',
      fontWeight: 500,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'var(--bolt-red-400)',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      '&:hover': {
        backgroundColor: 'var(--bolt-red-400-20)',
        color: 'var(--bolt-red-300)',
      },
      borderRadius: '0 0.375rem 0.375rem 0',
      padding: '0 4px',
      transition: 'all 150ms ease',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--bolt-elements-textPrimary)',
      margin: '2px',
      fontSize: '0.875rem',
      '& input': {
        color: 'var(--bolt-elements-textPrimary) !important',
      },
      '::placeholder': {
        color: 'var(--bolt-elements-textSecondary)',
      },
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--bolt-elements-textSecondary)',
      fontSize: '0.875rem',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'var(--bolt-elements-textSecondary)',
      padding: '8px 12px',
      fontSize: '0.875rem',
      backgroundColor: 'var(--bolt-elements-background-depth-2)',
      borderRadius: '0.375rem',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? 'var(--bolt-purple-400)' : 'var(--bolt-elements-textSecondary)',
      '&:hover': {
        color: 'var(--bolt-purple-500)',
        backgroundColor: 'var(--bolt-purple-500-10)',
      },
      padding: '2px 8px',
      transition: 'all 150ms ease',
      borderRadius: '0.25rem',
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--bolt-elements-textTertiary)',
      cursor: 'pointer',
      '&:hover': {
        color: 'var(--bolt-red-400)',
        backgroundColor: 'var(--bolt-red-400-10)',
      },
      padding: '2px 8px',
      transition: 'all 150ms ease',
      borderRadius: '0.25rem',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'var(--bolt-elements-borderColor)',
      margin: '6px 0',
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '2px 6px',
      gap: '4px',
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--bolt-elements-textPrimary)',
    }),
  };

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
        layout
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'hover:bg-bolt-elements-background-depth-3',
          'transition-all duration-300',
          'rounded-lg',
          'group',
          'border border-bolt-elements-borderColor',
          'hover:border-purple-500/30 dark:hover:border-purple-400/30',
          'shadow-sm hover:shadow-md',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-3">
          <div className="flex items-center gap-2">
            <div className="i-ph:sparkle-fill w-4 h-4 text-purple-500" />
            <p className="text-sm font-medium text-bolt-elements-textPrimary">Customize AI with Prompts and Rules</p>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div
              className={classNames(
                'p-2.5 rounded-lg text-xl',
                'bg-bolt-elements-background-depth-3',
                'transition-colors duration-200',
                'text-purple-500',
                'border border-bolt-elements-borderColor',
                'shadow-sm',
                'group-hover:border-purple-500/50 group-hover:bg-purple-100/50 dark:group-hover:bg-purple-900/20',
              )}
            >
              <div className="i-ph:book-bookmark-fill" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 dark:group-hover:text-purple-300 transition-colors">
                    Prompts & Rules Library
                  </h4>
                  <div className="px-1.5 py-0.5 rounded text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-medium">
                    Enhanced
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bolt-elements-textTertiary">Customize your AI assistance</span>
                </div>
              </div>
              <Select<PromptOption, true>
                isMulti
                options={allPromptOptions}
                value={selectedValues}
                onChange={handlePromptChange}
                className="react-select-container"
                classNamePrefix="react-select"
                placeholder={allPromptOptions.length > 0 ? 'Search prompts...' : 'No prompts available'}
                noOptionsMessage={() =>
                  allPromptOptions.length > 0 ? 'No prompts found' : 'No prompts available in library'
                }
                formatOptionLabel={({ label, description }: PromptOption) => (
                  <div className="flex flex-col py-1">
                    <span className="font-medium text-bolt-elements-textPrimary dark:text-gray-200">{label}</span>
                    {description && (
                      <span className="text-xs text-bolt-elements-textSecondary dark:text-gray-400 mt-0.5 line-clamp-1">
                        {description}
                      </span>
                    )}
                  </div>
                )}
                styles={{
                  ...selectStyles,
                  menu: (base) => ({
                    ...base,
                    backgroundColor: 'var(--bolt-elements-background-depth-1)',
                    border: '1px solid var(--bolt-elements-borderColor)',
                    boxShadow: 'var(--bolt-elements-shadow-md)',
                    overflow: 'hidden',
                    zIndex: 50,
                    borderRadius: '0.5rem',
                    marginTop: '4px',
                    padding: '2px',
                  }),
                  menuList: (base) => ({
                    ...base,
                    padding: '6px',
                    backgroundColor: 'var(--bolt-elements-background-depth-1)',
                    '&::-webkit-scrollbar': {
                      width: '8px',
                      height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'var(--bolt-elements-background-depth-2)',
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'var(--bolt-purple-400-20)',
                      borderRadius: '4px',
                      '&:hover': {
                        background: 'var(--bolt-purple-400-30)',
                      },
                    },
                  }),
                  multiValueRemove: (base) => ({
                    ...base,
                    color: 'var(--bolt-red-400)',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'var(--bolt-red-400-20)',
                      color: 'var(--bolt-red-300)',
                    },
                    borderRadius: '0 0.375rem 0.375rem 0',
                    padding: '0 4px',
                    transition: 'all 150ms ease',
                  }),
                  multiValue: (base) => ({
                    ...base,
                    backgroundColor: 'var(--bolt-purple-500-10)',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--bolt-purple-400-40)',
                    padding: '1px 2px',
                    margin: '2px',
                    boxShadow: 'var(--bolt-elements-shadow-sm)',
                    '&:hover': {
                      backgroundColor: 'var(--bolt-purple-400-15)',
                      border: '1px solid var(--bolt-purple-300)',
                    },
                  }),
                  clearIndicator: (base) => ({
                    ...base,
                    color: 'var(--bolt-elements-textTertiary)',
                    cursor: 'pointer',
                    '&:hover': {
                      color: 'var(--bolt-red-400)',
                      backgroundColor: 'var(--bolt-red-400-10)',
                    },
                    padding: '2px 8px',
                    transition: 'all 150ms ease',
                    borderRadius: '0.25rem',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused
                      ? 'var(--bolt-purple-500-15)'
                      : state.isSelected
                        ? 'var(--bolt-purple-500-25)'
                        : 'var(--bolt-elements-background-depth-2)',
                    color: state.isSelected ? 'var(--bolt-purple-300)' : 'var(--bolt-elements-textPrimary)',
                    padding: '8px 12px',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    marginBottom: '2px',
                    '&:active': {
                      backgroundColor: 'var(--bolt-purple-500-30)',
                      color: 'var(--bolt-purple-200)',
                    },
                    '&:hover': {
                      backgroundColor: 'var(--bolt-purple-400-20)',
                      color: 'var(--bolt-purple-300)',
                      borderColor: 'var(--bolt-purple-300)',
                    },
                    transition: 'all 150ms ease',
                  }),
                }}
                theme={(theme) => ({
                  ...theme,
                  colors: {
                    ...theme.colors,
                    primary: 'var(--bolt-purple-400)',
                    primary75: 'var(--bolt-purple-300)',
                    primary50: 'var(--bolt-purple-200)',
                    primary25: 'var(--bolt-purple-100)',
                    neutral0: 'var(--bolt-elements-background-depth-1)',
                    neutral5: 'var(--bolt-elements-background-depth-2)',
                    neutral10: 'var(--bolt-elements-background-depth-2)',
                    neutral20: 'var(--bolt-elements-borderColor)',
                    neutral30: 'var(--bolt-elements-borderColor)',
                    neutral40: 'var(--bolt-elements-textTertiary)',
                    neutral50: 'var(--bolt-elements-textSecondary)',
                    neutral60: 'var(--bolt-elements-textSecondary)',
                    neutral70: 'var(--bolt-elements-textPrimary)',
                    neutral80: 'var(--bolt-elements-textPrimary)',
                    neutral90: 'var(--bolt-elements-textPrimary)',
                    danger: 'var(--bolt-red-400)',
                    dangerLight: 'var(--bolt-red-500-20)',
                  },
                  spacing: {
                    ...theme.spacing,
                    baseUnit: 4,
                    controlHeight: 40,
                    menuGutter: 4,
                  },
                  borderRadius: 8,
                })}
                components={{
                  DropdownIndicator: (props) => (
                    <components.DropdownIndicator {...props}>
                      <div className="i-ph:caret-down w-4 h-4 text-purple-400 dark:text-purple-300 group-hover:text-purple-300 dark:group-hover:text-purple-200" />
                    </components.DropdownIndicator>
                  ),
                  ClearIndicator: (props) => (
                    <components.ClearIndicator {...props}>
                      <div className="i-ph:x w-4 h-4 text-bolt-red-400 hover:text-bolt-red-300 dark:text-bolt-red-300 dark:hover:text-bolt-red-200" />
                    </components.ClearIndicator>
                  ),
                  MultiValueLabel: (props) => (
                    <components.MultiValueLabel {...props}>
                      <div className="flex items-center px-1">
                        <div className="i-ph:book-open-text w-3 h-3 mr-1.5 text-purple-500 dark:text-purple-300" />
                        <span className="text-sm font-medium text-purple-800 dark:text-purple-100">
                          {props.data.label}
                        </span>
                      </div>
                    </components.MultiValueLabel>
                  ),
                  MultiValueRemove: (props) => (
                    <components.MultiValueRemove {...props}>
                      <div className="i-ph:x w-3.5 h-3.5 text-bolt-red-400 hover:text-bolt-red-300 dark:text-bolt-red-300 dark:hover:text-bolt-red-200 p-0.5" />
                    </components.MultiValueRemove>
                  ),
                  ValueContainer: (props) => {
                    const shouldShowSelected = allPromptOptions.length > 0 && selectedValues.length > 0;

                    return (
                      <components.ValueContainer {...props}>
                        {shouldShowSelected ? (
                          props.children
                        ) : (
                          <div className="text-bolt-elements-textSecondary">No prompts available</div>
                        )}
                      </components.ValueContainer>
                    );
                  },
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
