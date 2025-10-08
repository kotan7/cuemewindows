import { ipcMain, app, shell } from "electron";
import path from "path";
import type { AppState } from "../core/AppState";

/**
 * Utility IPC handlers
 * Handles debugging, protocol registration, and external URLs
 */
export function registerUtilityHandlers(appState: AppState): void {
  // Debug logging handler to show frontend logs in terminal
  ipcMain.handle("debug-log", async (event, message: string) => {
    console.log('[Frontend Debug]', message);
    return { success: true };
  });

  // Protocol handler status check
  ipcMain.handle("check-protocol-handler", async () => {
    try {
      console.log('[IPC] Checking protocol handler status...');
      const isDefaultForProtocol = app.isDefaultProtocolClient('cueme');
      console.log('[IPC] Is default protocol client for cueme://', isDefaultForProtocol);
      
      return { 
        success: true, 
        isDefault: isDefaultForProtocol,
        platform: process.platform,
        processArgs: process.argv
      };
    } catch (error: any) {
      console.error('[IPC] Error checking protocol handler:', error);
      return { success: false, error: error.message };
    }
  });

  // Force protocol registration
  ipcMain.handle("register-protocol-handler", async () => {
    try {
      console.log('[IPC] Enhanced protocol registration attempt...');
      
      let result = false;
      const methods: string[] = [];
      
      if (process.defaultApp) {
        console.log('[IPC] Development mode - trying enhanced registration');
        
        // Method 1: With process args
        if (process.argv.length >= 2) {
          result = app.setAsDefaultProtocolClient('cueme', process.execPath, [path.resolve(process.argv[1])]);
          methods.push(`Method 1 (args): ${result}`);
        }
        
        // Method 2: Simple
        if (!result) {
          result = app.setAsDefaultProtocolClient('cueme');
          methods.push(`Method 2 (simple): ${result}`);
        }
        
        // Method 3: With cwd
        if (!result) {
          result = app.setAsDefaultProtocolClient('cueme', process.execPath, [process.cwd()]);
          methods.push(`Method 3 (cwd): ${result}`);
        }
        
        // Method 4: macOS specific remove+register
        if (!result && process.platform === 'darwin') {
          app.removeAsDefaultProtocolClient('cueme');
          await new Promise(resolve => setTimeout(resolve, 500));
          result = app.setAsDefaultProtocolClient('cueme');
          methods.push(`Method 4 (remove+register): ${result}`);
        }
        
        // Method 5: Enhanced macOS registration
        if (!result && process.platform === 'darwin') {
          app.removeAsDefaultProtocolClient('cueme');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const electronPath = process.execPath;
          const mainScript = path.resolve(process.argv[1]);
          result = app.setAsDefaultProtocolClient('cueme', electronPath, [mainScript]);
          methods.push(`Method 5 (enhanced macOS): ${result}`);
        }
      } else {
        result = app.setAsDefaultProtocolClient('cueme');
        methods.push(`Production: ${result}`);
      }
      
      // Wait and verify
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isRegistered = app.isDefaultProtocolClient('cueme');
      
      console.log('[IPC] Registration methods tried:', methods);
      console.log('[IPC] Final verification:', isRegistered);
      
      return { 
        success: true, 
        registered: result,
        verified: isRegistered,
        platform: process.platform,
        methods: methods,
        note: !isRegistered && process.platform === 'darwin' ? 
          'macOS development limitation: verification may fail but functionality might work' : ''
      };
    } catch (error: any) {
      console.error('[IPC] Error in enhanced protocol registration:', error);
      return { success: false, error: error.message };
    }
  });

  // Deep link testing handler for debugging
  ipcMain.handle("test-deep-link", async (event, url: string, testMode: boolean = true) => {
    try {
      console.log('[IPC] Testing deep link manually:', url);
      console.log('[IPC] Test mode:', testMode);
      const { DeepLinkHandler } = await import('../core/DeepLinkHandler');
      const handler = new DeepLinkHandler(appState);
      handler.handleDeepLink(url, testMode);
      return { success: true, message: 'Deep link test initiated', testMode };
    } catch (error: any) {
      console.error('[IPC] Error testing deep link:', error);
      return { success: false, error: error.message };
    }
  });

  // Open external URL
  ipcMain.handle("open-external-url", async (event, url: string) => {
    try {
      console.log('[IPC] Opening external URL:', url);
      await shell.openExternal(url);
      console.log('[IPC] ✅ External URL opened successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] ❌ Error opening external URL:', error);
      return { success: false, error: error.message };
    }
  });
}
