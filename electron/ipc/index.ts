import type { AppState } from "../core/AppState";
import { registerWindowHandlers } from "./windowHandlers";
import { registerScreenshotHandlers } from "./screenshotHandlers";
import { registerAudioHandlers } from "./audioHandlers";
import { registerLLMHandlers } from "./llmHandlers";
import { registerAuthHandlers } from "./authHandlers";
import { registerQnAHandlers } from "./qnaHandlers";
import { registerPermissionHandlers } from "./permissionHandlers";
import { registerUtilityHandlers } from "./utilityHandlers";

/**
 * Initialize all IPC handlers
 * Registers handlers for all features organized by domain
 */
export function initializeIpcHandlers(appState: AppState): void {
  console.log('[IPC] Initializing IPC handlers...');
  
  // Register handlers by feature domain
  registerUtilityHandlers(appState);      // Debug, protocol, external URLs
  registerWindowHandlers(appState);       // Window management
  registerScreenshotHandlers(appState);   // Screenshot operations
  registerAudioHandlers(appState);        // Audio processing & streaming
  registerLLMHandlers(appState);          // AI/LLM operations
  registerAuthHandlers(appState);         // Authentication
  registerQnAHandlers(appState);          // Q&A collections
  registerPermissionHandlers(appState);   // Permission management
  
  console.log('[IPC] ✅ All IPC handlers initialized successfully');
}
