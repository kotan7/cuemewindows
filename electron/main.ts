import dotenv from "dotenv"
import path from "path"

// Load environment variables FIRST before any other imports
// Try multiple approaches to load .env file for better reliability
const envPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
  path.join(process.resourcesPath || process.cwd(), '.env.local'),
  path.join(process.resourcesPath || process.cwd(), '.env'),
  '.env.local',
  '.env'
]

let envLoaded = false
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath })
    if (!result.error) {
      console.log(`[ENV] Successfully loaded environment from: ${envPath}`)
      envLoaded = true
      break
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.log('[ENV] No .env file found, using default dotenv.config()')
  dotenv.config() // Fallback to default
}

import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { AuthService } from "./AuthService"
import { QnAService } from "./QnAService"
import { DocumentService } from "./DocumentService"
import { UsageTracker } from "./UsageTracker"
import { AudioStreamProcessor } from "./AudioStreamProcessor"

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  public authService: AuthService
  public qnaService: QnAService
  public documentService: DocumentService
  public usageTracker: UsageTracker
  public audioStreamProcessor: AudioStreamProcessor
  private tray: Tray | null = null

  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false

  // Processing events
  public readonly PROCESSING_EVENTS = {
    //global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    //states for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    //states for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this)

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view)

    // Initialize ProcessingHelper
    this.processingHelper = new ProcessingHelper(this)

    // Initialize AuthService
    this.authService = new AuthService()

    // Initialize UsageTracker (MUST be before auth listener setup)
    this.usageTracker = new UsageTracker()

    // Listen for auth state changes and broadcast to renderer
    this.authService.onAuthStateChange((authState) => {
      const mainWindow = this.getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('auth-state-changed', authState)
      }
      
      // Handle cache lifecycle based on auth state
      if (authState.user && authState.session?.access_token) {
        console.log('[AppState] User logged in, initializing usage cache')
        this.usageTracker.initializeCache(authState.session.access_token)
      } else {
        console.log('[AppState] User logged out, clearing usage cache')
        this.usageTracker.clearCache()
      }
    })

    // Initialize QnAService with AuthService's Supabase client
    this.qnaService = new QnAService(this.authService.getSupabaseClient())

    // Initialize DocumentService with AuthService's Supabase client
    this.documentService = new DocumentService(this.authService.getSupabaseClient())

    // Set QnAService and DocumentService in ProcessingHelper's LLMHelper
    this.processingHelper.getLLMHelper().setQnAService(this.qnaService)
    this.processingHelper.getLLMHelper().setDocumentService(this.documentService)

    // Initialize AudioStreamProcessor
    const openaiApiKey = process.env.OPENAI_API_KEY
    console.log('[AppState] OpenAI API Key status:', openaiApiKey ? 'Present' : 'Missing')
    console.log('[AppState] Environment variables loaded:', {
      NODE_ENV: process.env.NODE_ENV,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Present' : 'Missing',
      OPENAI_API_KEY: openaiApiKey ? 'Present' : 'Missing'
    })
    if (!openaiApiKey) {
      console.warn('[AppState] OPENAI_API_KEY not found - audio streaming will be disabled')
      // Create a disabled processor that logs warnings
      this.audioStreamProcessor = {
        async startListening() {
          console.warn('[AudioStreamProcessor] Cannot start - OpenAI API key not configured')
          return Promise.resolve()
        },
        async stopListening() {
          return Promise.resolve()
        },
        async processAudioChunk() {
          console.warn('[AudioStreamProcessor] Cannot process audio - OpenAI API key not configured')
          return Promise.resolve()
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
          }
        },
        getQuestions() { return [] },
        clearQuestions() {},
        setLLMHelper() {},
        on() { return this },
        emit() { return false }
      } as any
    } else {
      try {
        this.audioStreamProcessor = new AudioStreamProcessor(openaiApiKey, {
          questionDetectionEnabled: true,
          batchInterval: 30000, // 30 seconds from memory
          maxBatchSize: 3
        })
        
        // LLMHelper no longer needed - questions are refined algorithmically
        
        // Setup event listeners for audio stream events
        this.setupAudioStreamEvents()
        
        console.log('[AppState] AudioStreamProcessor initialized successfully')
      } catch (error) {
        console.error('[AppState] Failed to initialize AudioStreamProcessor:', error)
        // Fall back to disabled processor
        this.audioStreamProcessor = {
          async startListening() {
            console.error('[AudioStreamProcessor] Initialization failed - audio features disabled')
            return Promise.resolve()
          },
          async stopListening() { return Promise.resolve() },
          async processAudioChunk() { return Promise.resolve() },
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
            }
          },
          getQuestions() { return [] },
          clearQuestions() {},
          setLLMHelper() {},
          on() { return this },
          emit() { return false }
        } as any
      }
    }

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this)
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow()
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public centerAndShowWindow(): void {
    this.windowHelper.centerAndShowWindow()
  }

  public cleanupWindow(): void {
    this.windowHelper.cleanup()
  }

  public createTray(): void {
    // Create a simple tray icon
    const image = nativeImage.createEmpty()
    
    // Try to use a system template image for better integration
    let trayImage = image
    try {
      // Create a minimal icon - just use an empty image and set the title
      trayImage = nativeImage.createFromBuffer(Buffer.alloc(0))
    } catch (error) {
      console.log("Using empty tray image")
      trayImage = nativeImage.createEmpty()
    }
    
    this.tray = new Tray(trayImage)
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Interview Coder',
        click: () => {
          this.centerAndShowWindow()
        }
      },
      {
        label: 'Toggle Window',
        click: () => {
          this.toggleMainWindow()
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Take Screenshot (Cmd+H)',
        click: async () => {
          try {
            const screenshotPath = await this.takeScreenshot()
            const preview = await this.getImagePreview(screenshotPath)
            const mainWindow = this.getMainWindow()
            if (mainWindow) {
              mainWindow.webContents.send("screenshot-taken", {
                path: screenshotPath,
                preview
              })
            }
          } catch (error) {
            console.error("Error taking screenshot from tray:", error)
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
          app.quit()
        }
      }
    ])
    
    this.tray.setToolTip('Interview Coder - Press Cmd+Shift+Space to show')
    this.tray.setContextMenu(contextMenu)
    
    // Set a title for macOS (will appear in menu bar)
    if (process.platform === 'darwin') {
      this.tray.setTitle('IC')
    }
    
    // Double-click to show window
    this.tray.on('double-click', () => {
      this.centerAndShowWindow()
    })
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }

  /**
   * Setup event listeners for AudioStreamProcessor events
   */
  private setupAudioStreamEvents(): void {
    if (!this.audioStreamProcessor) return;
    
    const mainWindow = this.getMainWindow();
    if (!mainWindow) {
      // Delay setup until window is available
      setTimeout(() => this.setupAudioStreamEvents(), 1000);
      return;
    }

    // Forward audio stream events to renderer process
    this.audioStreamProcessor.on('question-detected', (question) => {
      mainWindow.webContents.send('audio-question-detected', question);
    });

    this.audioStreamProcessor.on('transcription-completed', (result) => {
      mainWindow.webContents.send('audio-transcription-completed', result);
    });

    this.audioStreamProcessor.on('state-changed', (state) => {
      mainWindow.webContents.send('audio-stream-state-changed', state);
    });

    this.audioStreamProcessor.on('error', (error) => {
      console.error('[AppState] Audio stream error:', error);
      mainWindow.webContents.send('audio-stream-error', error.message);
    });

    console.log('[AppState] Audio stream event listeners setup complete');
  }
}

// Application initialization
async function initializeApp() {
  const appState = AppState.getInstance()

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    console.log("App is ready")
    appState.createWindow()
    appState.createTray()
    // Register global shortcuts using ShortcutsHelper
    appState.shortcutsHelper.registerGlobalShortcuts()
  })

  app.on("activate", () => {
    console.log("App activated")
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  app.dock?.hide() // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
