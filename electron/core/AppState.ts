import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron";
import { WindowHelper } from "../WindowHelper";
import { ScreenshotHelper } from "../ScreenshotHelper";
import { ShortcutsHelper } from "../shortcuts";
import { ProcessingHelper } from "../ProcessingHelper";
import { AuthService } from "../AuthService";
import { QnAService } from "../QnAService";
import { DocumentService } from "../DocumentService";
import { UsageTracker } from "../UsageTracker";
import { AudioStreamProcessor } from "../AudioStreamProcessor";
import { PermissionStorage } from "../PermissionStorage";
import { AuthCallbackServer } from "./AuthCallbackServer";

/**
 * Central application state manager
 * Coordinates all services and manages app lifecycle
 */
export class AppState {
  private static instance: AppState | null = null;

  private windowHelper: WindowHelper;
  private screenshotHelper: ScreenshotHelper;
  public shortcutsHelper: ShortcutsHelper;
  public processingHelper: ProcessingHelper;
  public authService: AuthService;
  public qnaService: QnAService;
  public documentService: DocumentService;
  public usageTracker: UsageTracker;
  public audioStreamProcessor: AudioStreamProcessor;
  public permissionStorage: PermissionStorage;
  private authCallbackServer: AuthCallbackServer;
  private tray: Tray | null = null;

  // View management
  private view: "queue" | "solutions" = "queue";

  private problemInfo: {
    problem_statement: string;
    input_format: Record<string, any>;
    output_format: Record<string, any>;
    constraints: Array<Record<string, any>>;
    test_cases: Array<Record<string, any>>;
  } | null = null;

  private hasDebugged: boolean = false;

  // Processing events
  public readonly PROCESSING_EVENTS = {
    // Global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    // States for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    // States for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const;

  private constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this);

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view);

    // Initialize ProcessingHelper
    this.processingHelper = new ProcessingHelper(this);

    // Initialize AuthService
    this.authService = new AuthService();

    // Initialize UsageTracker (MUST be before auth listener setup)
    this.usageTracker = new UsageTracker();

    // Initialize PermissionStorage
    this.permissionStorage = new PermissionStorage();

    // Setup auth callback server
    this.authCallbackServer = new AuthCallbackServer(
      this.authService,
      () => this.getMainWindow(),
      () => this.showMainWindow()
    );
    this.authCallbackServer.start();

    // Listen for auth state changes and broadcast to renderer
    this.authService.onAuthStateChange((authState) => {
      const mainWindow = this.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('auth-state-changed', authState);
      }
      
      // Handle cache lifecycle based on auth state
      if (authState.user && authState.session?.access_token) {
        console.log('[AppState] User logged in, initializing usage cache');
        this.usageTracker.initializeCache(authState.session.access_token);
      } else {
        console.log('[AppState] User logged out, clearing usage cache');
        this.usageTracker.clearCache();
      }
    });

    // Initialize QnAService with AuthService's Supabase client
    this.qnaService = new QnAService(this.authService.getSupabaseClient());

    // Initialize DocumentService with AuthService's Supabase client
    this.documentService = new DocumentService(this.authService.getSupabaseClient());

    // Set QnAService and DocumentService in ProcessingHelper's LLMHelper
    this.processingHelper.getLLMHelper().setQnAService(this.qnaService);
    this.processingHelper.getLLMHelper().setDocumentService(this.documentService);

    // Initialize AudioStreamProcessor
    this.audioStreamProcessor = this.initializeAudioStreamProcessor();

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState();
    }
    return AppState.instance;
  }

  /**
   * Initialize AudioStreamProcessor with proper error handling
   */
  private initializeAudioStreamProcessor(): AudioStreamProcessor {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    console.log('[AppState] OpenAI API Key status:', openaiApiKey ? 'Present' : 'Missing');
    console.log('[AppState] Environment variables loaded:', {
      NODE_ENV: process.env.NODE_ENV,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present' : 'Missing',
      OPENAI_API_KEY: openaiApiKey ? 'Present' : 'Missing'
    });

    if (!openaiApiKey) {
      console.warn('[AppState] OPENAI_API_KEY not found - audio streaming will be disabled');
      return this.createDisabledAudioProcessor();
    }

    try {
      const processor = new AudioStreamProcessor(openaiApiKey, {
        questionDetectionEnabled: true,
        batchInterval: 30000, // 30 seconds
        maxBatchSize: 3
      });
      
      // Setup event listeners for audio stream events
      this.setupAudioStreamEvents(processor);
      
      console.log('[AppState] AudioStreamProcessor initialized successfully');
      return processor;
    } catch (error) {
      console.error('[AppState] Failed to initialize AudioStreamProcessor:', error);
      return this.createDisabledAudioProcessor();
    }
  }

  /**
   * Create a disabled audio processor stub
   */
  private createDisabledAudioProcessor(): AudioStreamProcessor {
    return {
      async startListening() {
        console.warn('[AudioStreamProcessor] Cannot start - OpenAI API key not configured');
        return Promise.resolve();
      },
      async stopListening() {
        return Promise.resolve();
      },
      async processAudioChunk() {
        console.warn('[AudioStreamProcessor] Cannot process audio - OpenAI API key not configured');
        return Promise.resolve();
      },
      getState() {
        return {
          isListening: false,
          isProcessing: false,
          lastActivityTime: 0,
          questionBuffer: [],
          batchProcessor: {
            lastBatchTime: 0,
            isProcessing: false,
            pendingQuestions: []
          }
        };
      },
      getQuestions() { return []; },
      clearQuestions() {},
      setLLMHelper() {},
      on() { return this; },
      emit() { return false; }
    } as any;
  }

  /**
   * Setup event listeners for AudioStreamProcessor events
   */
  private setupAudioStreamEvents(processor: AudioStreamProcessor): void {
    const getMainWindow = () => this.getMainWindow();
    
    // Delay setup until window is available
    const setupListeners = () => {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        setTimeout(setupListeners, 1000);
        return;
      }

      // Forward audio stream events to renderer process
      processor.on('question-detected', (question) => {
        mainWindow.webContents.send('audio-question-detected', question);
      });

      processor.on('transcription-completed', (result) => {
        mainWindow.webContents.send('audio-transcription-completed', result);
      });

      processor.on('state-changed', (state) => {
        mainWindow.webContents.send('audio-stream-state-changed', state);
      });

      processor.on('error', (error) => {
        console.error('[AppState] Audio stream error:', error);
        mainWindow.webContents.send('audio-stream-error', error.message);
      });

      console.log('[AppState] Audio stream event listeners setup complete');
    };

    setupListeners();
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow();
  }

  public getView(): "queue" | "solutions" {
    return this.view;
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view;
    this.screenshotHelper.setView(view);
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible();
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper;
  }

  public getProblemInfo(): any {
    return this.problemInfo;
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo;
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue();
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue();
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value;
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged;
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow();
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow();
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow();
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    );
    this.windowHelper.toggleMainWindow();
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height);
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues();
    this.problemInfo = null;
    this.setView("queue");
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available");

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    );

    return screenshotPath;
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath);
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path);
  }

  // Window movement methods
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft();
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight();
  }

  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown();
  }

  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp();
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow();
  }

  public cleanupWindow(): void {
    this.windowHelper.cleanup();
  }

  /**
   * Create system tray icon
   */
  public createTray(): void {
    // Create a simple tray icon
    const image = nativeImage.createEmpty();
    
    let trayImage = image;
    try {
      trayImage = nativeImage.createFromBuffer(Buffer.alloc(0));
    } catch (error) {
      console.log("Using empty tray image");
      trayImage = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(trayImage);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Interview Coder',
        click: () => {
          this.centerAndShowWindow();
        }
      },
      {
        label: 'Toggle Window',
        click: () => {
          this.toggleMainWindow();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Take Screenshot (Cmd+H)',
        click: async () => {
          try {
            const screenshotPath = await this.takeScreenshot();
            const preview = await this.getImagePreview(screenshotPath);
            const mainWindow = this.getMainWindow();
            if (mainWindow) {
              mainWindow.webContents.send("screenshot-taken", {
                path: screenshotPath,
                preview
              });
            }
          } catch (error) {
            console.error("Error taking screenshot from tray:", error);
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click: () => {
          app.quit();
        }
      }
    ]);
    
    this.tray.setToolTip('Interview Coder - Press Cmd+Shift+Space to show');
    this.tray.setContextMenu(contextMenu);
    
    // Set a title for macOS (will appear in menu bar)
    if (process.platform === 'darwin') {
      this.tray.setTitle('IC');
    }
    
    // Double-click to show window
    this.tray.on('double-click', () => {
      this.centerAndShowWindow();
    });
  }

  /**
   * Cleanup resources on app quit
   */
  public cleanup(): void {
    this.authCallbackServer.stop();
    this.cleanupWindow();
  }
}
