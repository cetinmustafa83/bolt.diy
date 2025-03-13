import type { WindowType, UserTabConfig } from '~/components/@settings/core/types';

export interface TabConfiguration {
  userTabs: UserTabConfig[];
  developerTabs: UserTabConfig[];
  window: WindowType;
}

export interface Settings {
  autoSelectTemplate: boolean;
  isLatestBranch: boolean;
  contextOptimizationEnabled: boolean;
  eventLogs: boolean;
  promptId: string;
  activePrompts: string[];
  tabConfiguration: TabConfiguration;
}
