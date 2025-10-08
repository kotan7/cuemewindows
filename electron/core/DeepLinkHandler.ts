import { app } from "electron";
import path from "path";
import { URL } from "url";
import type { AppState } from "./AppState";

/**
 * Deep link protocol handler for OAuth callbacks
 * Handles cueme:// protocol URLs for authentication
 */
export class DeepLinkHandler {
  private readonly protocol = 'cueme';

  constructor(private appState: AppState) {}

  /**
   * Setup deep link protocol handling
   * Registers protocol and sets up event listeners
   */
  setup(): void {
    console.log('[DeepLink Setup] Initializing deep link protocol handling...');
    
    // Register protocol
    this.registerProtocol();
    
    // Delayed verification and retry
    setTimeout(() => this.verifyRegistration(), 2000);

    // Handle second instance (Windows/Linux)
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      this.handleSecondInstance(commandLine);
    });

    // Handle deep link on macOS
    app.on('open-url', (event, url) => {
      console.log('[DeepLink Setup] ===== OPEN-URL EVENT RECEIVED =====');
      console.log('[DeepLink Setup] Received open-url event:', url);
      console.log('[DeepLink Setup] =====================================');
      event.preventDefault();
      this.handleDeepLink(url);
    });

    // Handle deep link from command line args on startup
    if (process.argv.length >= 2) {
      const url = process.argv.find(arg => arg.startsWith(`${this.protocol}://`));
      if (url) {
        console.log('[DeepLink Setup] Found deep link in startup args:', url);
        app.whenReady().then(() => {
          console.log('[DeepLink Setup] App ready, handling startup deep link');
          this.handleDeepLink(url);
        });
      }
    }
    
    console.log('[DeepLink Setup] Deep link protocol handling setup complete');
  }

  /**
   * Register protocol with multiple fallback methods
   */
  private registerProtocol(): boolean {
    let registered = false;
    const methods: string[] = [];
    
    if (process.defaultApp) {
      console.log('[DeepLink Setup] Development mode - trying multiple registration methods');
      
      // Method 1: With process.argv
      if (process.argv.length >= 2) {
        registered = app.setAsDefaultProtocolClient(this.protocol, process.execPath, [path.resolve(process.argv[1])]);
        methods.push(`Method 1 (with args): ${registered}`);
      }
      
      // Method 2: Simple registration
      if (!registered) {
        registered = app.setAsDefaultProtocolClient(this.protocol);
        methods.push(`Method 2 (simple): ${registered}`);
      }
      
      // Method 3: With cwd
      if (!registered) {
        registered = app.setAsDefaultProtocolClient(this.protocol, process.execPath, [process.cwd()]);
        methods.push(`Method 3 (with cwd): ${registered}`);
      }
      
      // Method 4: macOS specific remove+register
      if (!registered && process.platform === 'darwin') {
        app.removeAsDefaultProtocolClient(this.protocol);
        setTimeout(() => {
          registered = app.setAsDefaultProtocolClient(this.protocol);
          methods.push(`Method 4 (remove+register): ${registered}`);
        }, 500);
      }
    } else {
      console.log('[DeepLink Setup] Production mode');
      registered = app.setAsDefaultProtocolClient(this.protocol);
      methods.push(`Production: ${registered}`);
    }
    
    console.log('[DeepLink Setup] Registration methods tried:', methods);
    return registered;
  }

  /**
   * Verify protocol registration and retry if needed
   */
  private verifyRegistration(): void {
    const isRegistered = app.isDefaultProtocolClient(this.protocol);
    console.log('[DeepLink Setup] Verification after 2s:', isRegistered);
    
    if (!isRegistered) {
      console.log('[DeepLink Setup] Re-attempting registration...');
      const retryResult = this.registerProtocol();
      
      // For macOS development, try additional methods
      if (!retryResult && process.platform === 'darwin' && process.defaultApp) {
        console.log('[DeepLink Setup] 🔧 Applying macOS development workarounds...');
        this.applyMacOSWorkarounds();
      }
    } else {
      console.log('[DeepLink Setup] ✅ Protocol registration verified successfully!');
    }
  }

  /**
   * Apply macOS-specific workarounds for protocol registration
   */
  private applyMacOSWorkarounds(): void {
    try {
      const { exec } = require('child_process');
      const bundleId = app.getName() || 'com.electron.cueme';
      
      exec(`/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user && defaults write com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers -array-add '{LSHandlerContentType="public.url"; LSHandlerRoleAll="${bundleId}"; LSHandlerURLScheme="${this.protocol}";}'`, (error, stdout, stderr) => {
        if (error) {
          console.log('[DeepLink Setup] System registration failed:', error.message);
        } else {
          console.log('[DeepLink Setup] System registration attempted via lsregister');
        }
      });
    } catch (error) {
      console.log('[DeepLink Setup] System registration error:', error);
    }
    
    // Final check after all attempts
    setTimeout(() => {
      const finalCheck = app.isDefaultProtocolClient(this.protocol);
      console.log('[DeepLink Setup] Final verification:', finalCheck);
      
      if (!finalCheck) {
        console.log('[DeepLink Setup] ⚠️  Protocol registration verification failed');
        console.log('[DeepLink Setup] This is common in macOS development mode');
        console.log('[DeepLink Setup] The protocol handler may still work when triggered by the browser');
      } else {
        console.log('[DeepLink Setup] ✅ Protocol registration successful!');
      }
    }, 2000);
  }

  /**
   * Handle second instance launch (Windows/Linux)
   */
  private handleSecondInstance(commandLine: string[]): void {
    console.log('[DeepLink Setup] Second instance detected');
    console.log('[DeepLink Setup] Command line args:', commandLine);
    
    // Focus existing window
    const mainWindow = this.appState.getMainWindow();
    if (mainWindow) {
      console.log('[DeepLink Setup] Focusing existing window');
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.show();
    }

    // Handle deep link from command line
    const url = commandLine.find(arg => arg.startsWith(`${this.protocol}://`));
    if (url) {
      console.log('[DeepLink Setup] Found deep link in command line:', url);
      this.handleDeepLink(url);
    }
  }

  /**
   * Handle deep link authentication callback
   */
  handleDeepLink(url: string, testMode: boolean = false): void {
    console.log('[DeepLink] ===============================');
    console.log('[DeepLink] Received deep link URL:', url);
    console.log('[DeepLink] Test mode:', testMode);
    console.log('[DeepLink] ===============================');
    
    try {
      const urlObj = new URL(url);
      console.log('[DeepLink] URL object parsed:');
      console.log('[DeepLink] - protocol:', urlObj.protocol);
      console.log('[DeepLink] - pathname:', urlObj.pathname);
      console.log('[DeepLink] - search params:', urlObj.search);
      console.log('[DeepLink] - hash:', urlObj.hash);
      
      // Show the main window
      this.showAndFocusWindow();
      
      // Extract authentication tokens
      const { accessToken, refreshToken } = this.extractTokens(urlObj);
      
      if (accessToken && refreshToken) {
        console.log('[DeepLink] ✅ Found authentication tokens');
        
        if (testMode) {
          this.handleTestMode();
          return;
        }
        
        this.setAuthSession(accessToken, refreshToken);
      } else {
        console.log('[DeepLink] ❌ No authentication tokens found in URL');
        this.logUrlDebugInfo(url, urlObj);
      }
    } catch (error) {
      console.error('[DeepLink] ❌ Error parsing deep link URL:', error);
      console.error('[DeepLink] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
    
    console.log('[DeepLink] ==============================');
    console.log('[DeepLink] handleDeepLink() completed');
    console.log('[DeepLink] ==============================');
  }

  /**
   * Show and focus the main window
   */
  private showAndFocusWindow(): void {
    const mainWindow = this.appState.getMainWindow();
    if (mainWindow) {
      console.log('[DeepLink] Focusing main window...');
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.show();
    }
  }

  /**
   * Extract tokens from URL
   */
  private extractTokens(urlObj: URL): { accessToken: string | null; refreshToken: string | null } {
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    
    // Try URL parameters first
    accessToken = urlObj.searchParams.get('access_token');
    refreshToken = urlObj.searchParams.get('refresh_token');
    
    console.log('[DeepLink] Tokens from search params:');
    console.log('[DeepLink] - access_token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
    console.log('[DeepLink] - refresh_token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null');
    
    // If not found in params, try hash fragment
    if (!accessToken && urlObj.hash) {
      console.log('[DeepLink] Trying to extract tokens from hash fragment...');
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      accessToken = hashParams.get('access_token');
      refreshToken = hashParams.get('refresh_token');
      
      console.log('[DeepLink] Tokens from hash:');
      console.log('[DeepLink] - access_token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
      console.log('[DeepLink] - refresh_token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null');
    }
    
    return { accessToken, refreshToken };
  }

  /**
   * Handle test mode (skip Supabase validation)
   */
  private handleTestMode(): void {
    console.log('[DeepLink] 🧪 TEST MODE: Skipping Supabase validation, simulating successful auth');
    
    const mainWindow = this.appState.getMainWindow();
    if (mainWindow) {
      console.log('[DeepLink] Test mode - showing and focusing window...');
      this.appState.showMainWindow();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'floating');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.moveTop();
          console.log('[DeepLink] ✅ Test mode completed successfully!');
        }
      }, 500);
    }
    
    console.log('[DeepLink] ✅ TEST MODE: Deep link parsing and window management successful!');
  }

  /**
   * Set authentication session in Supabase
   */
  private setAuthSession(accessToken: string, refreshToken: string): void {
    console.log('[DeepLink] Setting session in Supabase...');
    
    const currentAuthState = this.appState.authService.getAuthState();
    console.log('[DeepLink] Current auth state before setting session:');
    console.log('[DeepLink] - user:', currentAuthState.user?.email || 'null');
    console.log('[DeepLink] - isLoading:', currentAuthState.isLoading);
    
    const supabase = this.appState.authService.getSupabaseClient();
    
    console.log('[DeepLink] Calling supabase.auth.setSession...');
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    }).then(({ data, error }) => {
      if (error) {
        console.error('[DeepLink] ❌ Error setting session:', error);
        console.error('[DeepLink] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
      } else {
        console.log('[DeepLink] ✅ Session set successfully!');
        console.log('[DeepLink] Session data:');
        console.log('[DeepLink] - user email:', data.session?.user?.email);
        console.log('[DeepLink] - user id:', data.session?.user?.id);
        console.log('[DeepLink] - expires at:', data.session?.expires_at);
        
        this.focusWindowAfterAuth();
      }
    }).catch((err) => {
      console.error('[DeepLink] ❌ Exception in setSession:', err);
    });
  }

  /**
   * Focus window after successful authentication
   */
  private focusWindowAfterAuth(): void {
    const mainWindow = this.appState.getMainWindow();
    console.log('[DeepLink] Main window available:', !!mainWindow);
    
    if (mainWindow) {
      console.log('[DeepLink] Showing and focusing main window...');
      this.appState.showMainWindow();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true, 'floating');
      
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.moveTop();
          console.log('[DeepLink] Window state after operations:');
          console.log('[DeepLink] - isVisible:', mainWindow.isVisible());
          console.log('[DeepLink] - isMinimized:', mainWindow.isMinimized());
          console.log('[DeepLink] - isFocused:', mainWindow.isFocused());
        }
      }, 500);
    } else {
      console.error('[DeepLink] ❌ Main window not available');
    }
  }

  /**
   * Log URL debug information
   */
  private logUrlDebugInfo(url: string, urlObj: URL): void {
    console.log('[DeepLink] URL breakdown for debugging:');
    console.log('[DeepLink] - Full URL:', url);
    console.log('[DeepLink] - Search string:', urlObj.search);
    console.log('[DeepLink] - Hash string:', urlObj.hash);
  }
}
