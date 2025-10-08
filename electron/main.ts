// Load environment variables FIRST before any other imports
import { EnvLoader } from "./core/EnvLoader";
EnvLoader.load();

import { app } from "electron";
import { initializeIpcHandlers } from "./ipc";
import { AppState } from "./core/AppState";
import { DeepLinkHandler } from "./core/DeepLinkHandler";

/**
 * Request microphone access on app startup
 */
async function requestMicAccess(appState: AppState): Promise<void> {
  if (process.platform !== 'darwin') {
    console.log('[Permission] Microphone permission request only available on macOS');
    return;
  }
  
  try {
    console.log('[Permission] Requesting microphone permission...');
    const granted = await appState.permissionStorage.requestMicrophonePermission();
    
    if (granted) {
      console.log('[Permission] ✅ Microphone access granted');
    } else {
      console.log('[Permission] ❌ Microphone access denied');
    }
  } catch (error) {
    console.error('[Permission] Error requesting microphone permission:', error);
  }
}

/**
 * Application initialization
 */
async function initializeApp() {
  console.log('[App Init] ==============================');
  console.log('[App Init] Starting application initialization...');
  console.log('[App Init] Process args:', process.argv);
  console.log('[App Init] ==============================');
  
  // Validate environment variables
  const envValidation = EnvLoader.validate();
  if (!envValidation.valid) {
    console.error('[App Init] ❌ Missing required environment variables:', envValidation.missing);
    // Continue anyway - some features may be disabled
  }
  
  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  console.log('[App Init] Single instance lock acquired:', gotTheLock);
  
  if (!gotTheLock) {
    console.log('[App Init] Another instance is running, quitting...');
    app.quit();
    return;
  }

  const appState = AppState.getInstance();
  console.log('[App Init] AppState instance created');

  // Initialize IPC handlers before window creation
  console.log('[App Init] Initializing IPC handlers...');
  initializeIpcHandlers(appState);

  // Set up deep link protocol handling
  console.log('[App Init] Setting up deep link protocol handling...');
  const deepLinkHandler = new DeepLinkHandler(appState);
  deepLinkHandler.setup();

  app.whenReady().then(async () => {
    console.log('[App Init] ✅ Electron app is ready!');
    console.log('[App Init] Creating main window...');
    appState.createWindow();
    
    console.log('[App Init] Creating system tray...');
    appState.createTray();
    
    // Register global shortcuts using ShortcutsHelper
    console.log('[App Init] Registering global shortcuts...');
    appState.shortcutsHelper.registerGlobalShortcuts();
    
    // Request microphone permission on startup
    console.log('[App Init] Requesting microphone permission...');
    await requestMicAccess(appState);
    
    console.log('[App Init] ✅ App initialization completed successfully!');
  });

  app.on("activate", () => {
    console.log('[App Init] App activated (macOS dock click or similar)');
    if (appState.getMainWindow() === null) {
      console.log('[App Init] No main window, creating new one...');
      appState.createWindow();
    }
  });

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    console.log('[App Init] All windows closed');
    if (process.platform !== "darwin") {
      console.log('[App Init] Not macOS, quitting app...');
      app.quit();
    }
  });

  app.on('will-quit', () => {
    console.log('[App Init] App will quit');
    appState.cleanup();
  });

  app.on('before-quit', () => {
    console.log('[App Init] App before quit');
  });

  app.dock?.hide(); // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  
  console.log('[App Init] App initialization setup complete');
}

// Start the application
initializeApp().catch(console.error);
