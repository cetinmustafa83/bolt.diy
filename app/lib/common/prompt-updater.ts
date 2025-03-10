import { checkAndUpdatePrompts, getPromptUpdateUrls } from './prompts/url-fetcher';
import { logStore } from '../stores/logs';

// Key for storing the last check timestamp
const LAST_CHECK_KEY = 'bolt_prompt_update_last_check';

/**
 * Check if we should update prompts based on the check interval
 * By default, we check once every 24 hours
 */
export function shouldCheckForUpdates(checkIntervalHours = 24): boolean {
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  
  if (!lastCheck) {
    return true;
  }
  
  const lastCheckTime = parseInt(lastCheck, 10);
  const now = Date.now();
  const hoursSinceLastCheck = (now - lastCheckTime) / (1000 * 60 * 60);
  
  return hoursSinceLastCheck >= checkIntervalHours;
}

/**
 * Update the last check timestamp
 */
export function updateLastCheckTimestamp(): void {
  localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
}

/**
 * Initialize prompt updates
 * This should be called when the application starts
 * It will check for updates if the check interval has passed
 */
export async function initializePromptUpdates(): Promise<void> {
  // If there are no prompt URLs configured, don't bother checking
  const promptUrls = getPromptUpdateUrls();
  if (promptUrls.length === 0) {
    return;
  }
  
  // Check if we should update prompts
  if (shouldCheckForUpdates()) {
    try {
      // Run the update process
      const updatedCount = await checkAndUpdatePrompts();
      
      // Log the results
      if (updatedCount > 0) {
        logStore.logSystem(`Automatically updated ${updatedCount} prompts from URL sources`);
      }
      
      // Update the last check timestamp
      updateLastCheckTimestamp();
    } catch (error) {
      console.error('Error during automatic prompt update:', error);
      logStore.logWarning('Automatic prompt update failed', {
        type: 'prompt-update',
        message: error instanceof Error ? error.message : 'Unknown error during prompt update',
      });
    }
  }
} 