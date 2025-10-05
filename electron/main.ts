import dotenv from "dotenv"
import path from "path"
import http from "http"
import { URL } from "url"

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
import { PermissionStorage } from "./PermissionStorage"

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
  public permissionStorage: PermissionStorage
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

    // Initialize PermissionStorage
    this.permissionStorage = new PermissionStorage()

    // Setup auth callback server
    this.setupAuthCallbackServer()

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
   * Setup HTTP server to handle auth callbacks from web browser
   */
  private setupAuthCallbackServer(): void {
    const server = http.createServer((req, res) => {
      console.log('[AuthCallback] Received request:', req.url)
      
      if (req.url?.startsWith('/auth/callback')) {
        try {
          const url = new URL(req.url, 'http://localhost:3001')
          const accessToken = url.searchParams.get('access_token')
          const refreshToken = url.searchParams.get('refresh_token')
          const testMode = url.searchParams.get('test_mode') === 'true'
          
          console.log('[AuthCallback] Extracted tokens:')
          console.log('[AuthCallback] - Access token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null')
          console.log('[AuthCallback] - Refresh token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null')
          console.log('[AuthCallback] - Test mode:', testMode)
          
          if (accessToken && refreshToken) {
            // Set session in AuthService
            this.authService.setSessionFromTokens(accessToken, refreshToken)
              .then(() => {
                console.log('[AuthCallback] ✅ Authentication successful')
                
                // Show and focus the window
                const mainWindow = this.getMainWindow()
                if (mainWindow) {
                  this.showMainWindow()
                  mainWindow.focus()
                  mainWindow.setAlwaysOnTop(true, 'floating')
                  setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                      mainWindow.setAlwaysOnTop(false)
                    }
                  }, 2000)
                }
              })
              .catch((error) => {
                console.error('[AuthCallback] ❌ Authentication failed:', error)
              })
            
            // Send success response with dashboard-like page
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head>
                  <title>CueMe - 認証完了</title>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      background: linear-gradient(135deg, #F7F7EE 0%, #e8f5e8 100%);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #333;
                    }
                    .container {
                      background: rgba(255, 255, 255, 0.9);
                      backdrop-filter: blur(10px);
                      border-radius: 20px;
                      padding: 40px;
                      text-align: center;
                      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                      max-width: 500px;
                      width: 90%;
                    }
                    .logo {
                      width: 80px;
                      height: 80px;
                      background: #f0f9f0;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      margin: 0 auto 20px;
                      font-size: 40px;
                    }
                    h1 {
                      color: #013220;
                      font-size: 32px;
                      font-weight: bold;
                      margin-bottom: 10px;
                    }
                    h2 {
                      color: #065f46;
                      font-size: 24px;
                      margin-bottom: 20px;
                    }
                    p {
                      color: #666;
                      font-size: 16px;
                      line-height: 1.6;
                      margin-bottom: 30px;
                    }
                    .features {
                      text-align: left;
                      background: rgba(1, 50, 32, 0.05);
                      border-radius: 15px;
                      padding: 25px;
                      margin: 20px 0;
                    }
                    .features h3 {
                      color: #013220;
                      font-size: 18px;
                      margin-bottom: 15px;
                      text-align: center;
                    }
                    .feature-item {
                      display: flex;
                      align-items: center;
                      margin: 12px 0;
                      font-size: 14px;
                      color: #555;
                    }
                    .check {
                      color: #10b981;
                      margin-right: 10px;
                      font-weight: bold;
                    }
                    .close-note {
                      background: rgba(16, 185, 129, 0.1);
                      border: 1px solid rgba(16, 185, 129, 0.3);
                      border-radius: 10px;
                      padding: 15px;
                      font-size: 14px;
                      color: #065f46;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="logo">✅</div>
                    <h1>CueMe</h1>
                    <h2>認証成功！</h2>
                    <p>ログインが完了しました。アプリで質問回答コレクションを使って面接対策を始めましょう。</p>
                    
                    <div class="features">
                      <h3>🚀 利用可能な機能</h3>
                      <div class="feature-item">
                        <span class="check">✓</span>
                        AIによる音声質問分析
                      </div>
                      <div class="feature-item">
                        <span class="check">✓</span>
                        スクリーンショット自動解析
                      </div>
                      <div class="feature-item">
                        <span class="check">✓</span>
                        質問回答コレクション作成
                      </div>
                      <div class="feature-item">
                        <span class="check">✓</span>
                        面接モード対応
                      </div>
                      <div class="feature-item">
                        <span class="check">✓</span>
                        リアルタイム回答支援
                      </div>
                    </div>
                    
                    <div class="close-note">
                      💡 このタブを閉じて、CueMeアプリをお楽しみください！
                    </div>
                  </div>
                  
                  <script>
                    // Auto-close tab after 5 seconds
                    setTimeout(() => {
                      try {
                        window.close();
                      } catch (e) {
                        // Fallback if window.close() is blocked
                        document.body.innerHTML = '<div class="container"><h2 style="color: #013220;">このタブを閉じてアプリに戻ってください</h2></div>';
                      }
                    }, 5000);
                  </script>
                </body>
              </html>
            `)
          } else {
            // Missing tokens
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2>❌ Authentication Failed</h2>
                  <p>Missing authentication tokens. Please try again.</p>
                </body>
              </html>
            `)
          }
        } catch (error) {
          console.error('[AuthCallback] Error processing callback:', error)
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2>❌ Server Error</h2>
                <p>An error occurred processing the authentication callback.</p>
              </body>
            </html>
          `)
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    })
    
    server.listen(3001, 'localhost', () => {
      console.log('[AuthCallback] Auth callback server listening on http://localhost:3001')
    })
    
    server.on('error', (error) => {
      console.error('[AuthCallback] Server error:', error)
    })
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

/**
 * Setup deep link protocol handling for authentication
 */
function setupDeepLinkHandling(appState: AppState): void {
  console.log('[DeepLink Setup] Initializing deep link protocol handling...')
  
  // Multiple registration attempts for macOS development reliability
  const registerProtocol = () => {
    let registered = false
    
    if (process.defaultApp) {
      console.log('[DeepLink Setup] Development mode - trying multiple registration methods')
      
      // Method 1: With process.argv (most reliable for development)
      if (process.argv.length >= 2) {
        registered = app.setAsDefaultProtocolClient('cueme', process.execPath, [path.resolve(process.argv[1])])
        console.log('[DeepLink Setup] Method 1 (with args):', registered)
      }
      
      // Method 2: Simple registration
      if (!registered) {
        registered = app.setAsDefaultProtocolClient('cueme')
        console.log('[DeepLink Setup] Method 2 (simple):', registered)
      }
      
      // Method 3: Force with current working directory
      if (!registered) {
        registered = app.setAsDefaultProtocolClient('cueme', process.execPath, [process.cwd()])
        console.log('[DeepLink Setup] Method 3 (with cwd):', registered)
      }
      
      // Method 4: Remove and re-register (macOS specific)
      if (!registered && process.platform === 'darwin') {
        console.log('[DeepLink Setup] macOS specific: remove and re-register')
        app.removeAsDefaultProtocolClient('cueme')
        setTimeout(() => {
          registered = app.setAsDefaultProtocolClient('cueme')
          console.log('[DeepLink Setup] Method 4 (remove+register):', registered)
        }, 500)
      }
      
      // Method 5: Enhanced macOS development registration
      if (!registered && process.platform === 'darwin') {
        console.log('[DeepLink Setup] Enhanced macOS development registration...')
        try {
          // First remove any existing registration
          app.removeAsDefaultProtocolClient('cueme')
          
          // Wait a bit for system to process
          setTimeout(() => {
            // Try with full path and proper arguments for Electron development
            const electronPath = process.execPath
            const mainScript = path.resolve(process.argv[1])
            console.log('[DeepLink Setup] Electron path:', electronPath)
            console.log('[DeepLink Setup] Main script:', mainScript)
            
            registered = app.setAsDefaultProtocolClient('cueme', electronPath, [mainScript])
            console.log('[DeepLink Setup] Method 5 (enhanced macOS):', registered)
            
            // Final verification
            setTimeout(() => {
              const verified = app.isDefaultProtocolClient('cueme')
              console.log('[DeepLink Setup] Final verification:', verified)
              
              if (!verified) {
                console.log('[DeepLink Setup] ⚠️  Protocol registration failed - manual setup may be required')
                console.log('[DeepLink Setup] For testing, you can manually test with:')
                console.log('[DeepLink Setup] open "cueme://test-protocol"')
              } else {
                console.log('[DeepLink Setup] ✅ Protocol registration successful!')
              }
            }, 1000)
          }, 1000)
        } catch (error) {
          console.error('[DeepLink Setup] Enhanced registration error:', error)
        }
      }
    } else {
      console.log('[DeepLink Setup] Production mode')
      registered = app.setAsDefaultProtocolClient('cueme')
      console.log('[DeepLink Setup] Production registration:', registered)
    }
    
    return registered
  }
  
  // Initial registration
  registerProtocol()
  
  // Delayed verification and retry with enhanced macOS handling
  setTimeout(async () => {
    const isRegistered = app.isDefaultProtocolClient('cueme')
    console.log('[DeepLink Setup] Verification after 2s:', isRegistered)
    
    if (!isRegistered) {
      console.log('[DeepLink Setup] Re-attempting registration...')
      const retryResult = registerProtocol()
      
      // For macOS development, try additional methods
      if (!retryResult && process.platform === 'darwin' && process.defaultApp) {
        console.log('[DeepLink Setup] 🔧 Applying macOS development workarounds...')
        
        // Try manual system registration via LSSetDefaultHandlerForURLScheme (if available)
        try {
          const { exec } = require('child_process')
          const bundleId = app.getName() || 'com.electron.cueme'
          
          // Try to register using system tools
          exec(`/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user && defaults write com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers -array-add '{LSHandlerContentType="public.url"; LSHandlerRoleAll="${bundleId}"; LSHandlerURLScheme="cueme";}'`, (error, stdout, stderr) => {
            if (error) {
              console.log('[DeepLink Setup] System registration failed:', error.message)
            } else {
              console.log('[DeepLink Setup] System registration attempted via lsregister')
            }
          })
        } catch (error) {
          console.log('[DeepLink Setup] System registration error:', error)
        }
        
        // Final check after all attempts
        setTimeout(() => {
          const finalCheck = app.isDefaultProtocolClient('cueme')
          console.log('[DeepLink Setup] Final verification:', finalCheck)
          
          if (!finalCheck) {
            console.log('[DeepLink Setup] ⚠️  Protocol registration verification failed')
            console.log('[DeepLink Setup] This is common in macOS development mode')
            console.log('[DeepLink Setup] The protocol handler may still work when triggered by the browser')
            console.log('[DeepLink Setup] For testing, try clicking the launch button in the web app')
          } else {
            console.log('[DeepLink Setup] ✅ Protocol registration successful!')
          }
        }, 2000)
      }
    } else {
      console.log('[DeepLink Setup] ✅ Protocol registration verified successfully!')
    }
  }, 2000)

  // Handle the protocol on Windows and Linux
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[DeepLink Setup] Second instance detected')
    console.log('[DeepLink Setup] Command line args:', commandLine)
    
    // Someone tried to run a second instance, focus our window instead
    const mainWindow = appState.getMainWindow()
    if (mainWindow) {
      console.log('[DeepLink Setup] Focusing existing window')
      if (mainWindow.isMinimized()) {
        console.log('[DeepLink Setup] Restoring minimized window')
        mainWindow.restore()
      }
      mainWindow.focus()
      mainWindow.show()
    }

    // Handle deep link from command line
    const url = commandLine.find(arg => arg.startsWith('cueme://'))
    if (url) {
      console.log('[DeepLink Setup] Found deep link in command line:', url)
      handleDeepLink(appState, url)
    } else {
      console.log('[DeepLink Setup] No deep link found in command line')
    }
  })

  // Handle deep link on macOS
  app.on('open-url', (event, url) => {
    console.log('[DeepLink Setup] ===== OPEN-URL EVENT RECEIVED =====')
    console.log('[DeepLink Setup] Received open-url event:', url)
    console.log('[DeepLink Setup] Event object:', event)
    console.log('[DeepLink Setup] =====================================')
    event.preventDefault()
    handleDeepLink(appState, url)
  })

  // Handle deep link from command line args on startup
  if (process.argv.length >= 2) {
    const url = process.argv.find(arg => arg.startsWith('cueme://'))
    if (url) {
      console.log('[DeepLink Setup] Found deep link in startup args:', url)
      // Delay handling until app is ready
      app.whenReady().then(() => {
        console.log('[DeepLink Setup] App ready, handling startup deep link')
        handleDeepLink(appState, url)
      })
    } else {
      console.log('[DeepLink Setup] No deep link found in startup args')
    }
  }
  
  console.log('[DeepLink Setup] Deep link protocol handling setup complete')
}

/**
 * Handle deep link authentication callback
 */
export function handleDeepLink(appState: AppState, url: string, testMode: boolean = false): void {
  console.log('[DeepLink] ===============================')
  console.log('[DeepLink] Received deep link URL:', url)
  console.log('[DeepLink] Test mode:', testMode)
  console.log('[DeepLink] ===============================')
  
  try {
    const urlObj = new URL(url)
    console.log('[DeepLink] URL object parsed:')
    console.log('[DeepLink] - protocol:', urlObj.protocol)
    console.log('[DeepLink] - pathname:', urlObj.pathname)
    console.log('[DeepLink] - search params:', urlObj.search)
    console.log('[DeepLink] - hash:', urlObj.hash)
    
    // Show the main window when deep link is received
    const mainWindow = appState.getMainWindow()
    if (mainWindow) {
      console.log('[DeepLink] Focusing main window...')
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
      mainWindow.show()
    }
    
    // Extract authentication tokens from URL parameters or hash
    let accessToken: string | null = null
    let refreshToken: string | null = null
    
    // Try URL parameters first
    accessToken = urlObj.searchParams.get('access_token')
    refreshToken = urlObj.searchParams.get('refresh_token')
    
    console.log('[DeepLink] Tokens from search params:')
    console.log('[DeepLink] - access_token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null')
    console.log('[DeepLink] - refresh_token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null')
    
    // If not found in params, try hash fragment
    if (!accessToken && urlObj.hash) {
      console.log('[DeepLink] Trying to extract tokens from hash fragment...')
      const hashParams = new URLSearchParams(urlObj.hash.substring(1))
      accessToken = hashParams.get('access_token')
      refreshToken = hashParams.get('refresh_token')
      
      console.log('[DeepLink] Tokens from hash:')
      console.log('[DeepLink] - access_token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null')
      console.log('[DeepLink] - refresh_token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null')
    }
    
    if (accessToken && refreshToken) {
      console.log('[DeepLink] ✅ Found authentication tokens')
      
      if (testMode) {
        console.log('[DeepLink] 🧪 TEST MODE: Skipping Supabase validation, simulating successful auth')
        
        // In test mode, just show window and simulate success
        const mainWindow = appState.getMainWindow()
        if (mainWindow) {
          console.log('[DeepLink] Test mode - showing and focusing window...')
          appState.showMainWindow()
          mainWindow.focus()
          mainWindow.setAlwaysOnTop(true, 'floating')
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.moveTop()
              console.log('[DeepLink] ✅ Test mode completed successfully!')
            }
          }, 500)
        }
        
        console.log('[DeepLink] ✅ TEST MODE: Deep link parsing and window management successful!')
        return
      }
      
      console.log('[DeepLink] Setting session in Supabase...')
      
      // Check current auth state before setting session
      const currentAuthState = appState.authService.getAuthState()
      console.log('[DeepLink] Current auth state before setting session:')
      console.log('[DeepLink] - user:', currentAuthState.user?.email || 'null')
      console.log('[DeepLink] - isLoading:', currentAuthState.isLoading)
      
      // Set the session in AuthService
      const authService = appState.authService
      const supabase = authService.getSupabaseClient()
      
      console.log('[DeepLink] Calling supabase.auth.setSession...')
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ data, error }) => {
        if (error) {
          console.error('[DeepLink] ❌ Error setting session:', error)
          console.error('[DeepLink] Error details:', {
            message: error.message,
            status: error.status,
            name: error.name
          })
        } else {
          console.log('[DeepLink] ✅ Session set successfully!')
          console.log('[DeepLink] Session data:')
          console.log('[DeepLink] - user email:', data.session?.user?.email)
          console.log('[DeepLink] - user id:', data.session?.user?.id)
          console.log('[DeepLink] - expires at:', data.session?.expires_at)
          
          // Show and focus the main window
          const mainWindow = appState.getMainWindow()
          console.log('[DeepLink] Main window available:', !!mainWindow)
          
          if (mainWindow) {
            console.log('[DeepLink] Showing and focusing main window...')
            
            // Show window first
            appState.showMainWindow()
            console.log('[DeepLink] showMainWindow() called')
            
            // Focus the window
            mainWindow.focus()
            console.log('[DeepLink] mainWindow.focus() called')
            
            // Set always on top
            mainWindow.setAlwaysOnTop(true, 'floating')
            console.log('[DeepLink] setAlwaysOnTop(true, "floating") called')
            
            // Move to top with delay
            setTimeout(() => {
              console.log('[DeepLink] Moving window to top...')
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.moveTop()
                console.log('[DeepLink] moveTop() called')
                
                // Check if window is visible
                console.log('[DeepLink] Window state after operations:')
                console.log('[DeepLink] - isVisible:', mainWindow.isVisible())
                console.log('[DeepLink] - isMinimized:', mainWindow.isMinimized())
                console.log('[DeepLink] - isFocused:', mainWindow.isFocused())
              } else {
                console.error('[DeepLink] ❌ Main window destroyed or unavailable')
              }
            }, 500)
          } else {
            console.error('[DeepLink] ❌ Main window not available')
          }
        }
      }).catch((err) => {
        console.error('[DeepLink] ❌ Exception in setSession:', err)
      })
    } else {
      console.log('[DeepLink] ❌ No authentication tokens found in URL')
      console.log('[DeepLink] URL breakdown for debugging:')
      console.log('[DeepLink] - Full URL:', url)
      console.log('[DeepLink] - Search string:', urlObj.search)
      console.log('[DeepLink] - Hash string:', urlObj.hash)
    }
  } catch (error) {
    console.error('[DeepLink] ❌ Error parsing deep link URL:', error)
    console.error('[DeepLink] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
  }
  
  console.log('[DeepLink] ==============================')
  console.log('[DeepLink] handleDeepLink() completed')
  console.log('[DeepLink] ==============================')
}

/**
 * Request microphone access on app startup
 */
async function requestMicAccess(appState: AppState): Promise<void> {
  if (process.platform !== 'darwin') {
    console.log('[Permission] Microphone permission request only available on macOS')
    return
  }
  
  try {
    console.log('[Permission] Requesting microphone permission...')
    const granted = await appState.permissionStorage.requestMicrophonePermission()
    
    if (granted) {
      console.log('[Permission] ✅ Microphone access granted')
    } else {
      console.log('[Permission] ❌ Microphone access denied')
    }
  } catch (error) {
    console.error('[Permission] Error requesting microphone permission:', error)
  }
}

// Application initialization
async function initializeApp() {
  console.log('[App Init] ==============================')
  console.log('[App Init] Starting application initialization...')
  console.log('[App Init] Process args:', process.argv)
  console.log('[App Init] ==============================')
  
  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock()
  console.log('[App Init] Single instance lock acquired:', gotTheLock)
  
  if (!gotTheLock) {
    console.log('[App Init] Another instance is running, quitting...')
    app.quit()
    return
  }

  const appState = AppState.getInstance()
  console.log('[App Init] AppState instance created')

  // Initialize IPC handlers before window creation
  console.log('[App Init] Initializing IPC handlers...')
  initializeIpcHandlers(appState)

  // Set up deep link protocol handling
  console.log('[App Init] Setting up deep link protocol handling...')
  setupDeepLinkHandling(appState)

  app.whenReady().then(async () => {
    console.log('[App Init] ✅ Electron app is ready!')
    console.log('[App Init] Creating main window...')
    appState.createWindow()
    
    console.log('[App Init] Creating system tray...')
    appState.createTray()
    
    // Register global shortcuts using ShortcutsHelper
    console.log('[App Init] Registering global shortcuts...')
    appState.shortcutsHelper.registerGlobalShortcuts()
    
    // Request microphone permission on startup
    console.log('[App Init] Requesting microphone permission...')
    await requestMicAccess(appState)
    
    console.log('[App Init] ✅ App initialization completed successfully!')
  })

  app.on("activate", () => {
    console.log('[App Init] App activated (macOS dock click or similar)')
    if (appState.getMainWindow() === null) {
      console.log('[App Init] No main window, creating new one...')
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    console.log('[App Init] All windows closed')
    if (process.platform !== "darwin") {
      console.log('[App Init] Not macOS, quitting app...')
      app.quit()
    }
  })

  app.on('will-quit', () => {
    console.log('[App Init] App will quit')
  })

  app.on('before-quit', () => {
    console.log('[App Init] App before quit')
  })

  app.dock?.hide() // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling")
  
  console.log('[App Init] App initialization setup complete')
}

// Start the application
initializeApp().catch(console.error)
