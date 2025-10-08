import { ipcMain, shell } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Permission management IPC handlers
 * Handles microphone and screen capture permissions
 */
export function registerPermissionHandlers(appState: AppState): void {
  // Check if this is first time setup
  ipcMain.handle("permission-check-first-time", async () => {
    try {
      const isFirstTime = await appState.permissionStorage.isFirstTimeSetup();
      return { isFirstTime };
    } catch (error: any) {
      console.error("Error checking first time setup:", error);
      return { isFirstTime: true }; // Default to first time if error
    }
  });

  // Check current permission status
  ipcMain.handle("permission-check-status", async () => {
    try {
      const status = await appState.permissionStorage.getCurrentPermissionStatus();
      return status;
    } catch (error: any) {
      console.error("Error checking permission status:", error);
      return {
        microphone: 'unknown',
        screenCapture: 'unknown'
      };
    }
  });

  // Request microphone permission
  ipcMain.handle("permission-request-microphone", async () => {
    try {
      const granted = await appState.permissionStorage.requestMicrophonePermission();
      return { granted };
    } catch (error: any) {
      console.error("Error requesting microphone permission:", error);
      return { granted: false, error: error.message };
    }
  });

  // Open system preferences for permissions
  ipcMain.handle("permission-open-system-preferences", async (event, permissionType?: string) => {
    try {
      if (process.platform === 'darwin') {
        let url = 'x-apple.systempreferences:com.apple.preference.security?Privacy';
        
        // Open specific privacy settings based on permission type
        if (permissionType === 'microphone') {
          url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
        } else if (permissionType === 'screen') {
          url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
        }
        
        console.log('[IPC] Opening macOS system preferences:', url);
        await shell.openExternal(url);
      } else if (process.platform === 'win32') {
        // Open Windows Privacy settings based on permission type
        let url = 'ms-settings:privacy-microphone';
        if (permissionType === 'screen') {
          url = 'ms-settings:privacy-screencapture';
        }
        
        console.log('[IPC] Opening Windows privacy settings:', url);
        await shell.openExternal(url);
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error opening system preferences:", error);
      return { success: false, error: error.message };
    }
  });

  // Mark initial setup as completed
  ipcMain.handle("permission-mark-setup-completed", async () => {
    try {
      const success = await appState.permissionStorage.markInitialSetupCompleted();
      return { success };
    } catch (error: any) {
      console.error("Error marking setup completed:", error);
      return { success: false, error: error.message };
    }
  });
}
