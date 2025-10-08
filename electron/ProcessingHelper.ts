// ProcessingHelper.ts

import { AppState } from "./core/AppState"
import { LLMHelper } from "./LLMHelper"
// Note: dotenv is already loaded in main.ts, no need to load again

const isDev = process.env.NODE_ENV === "development"
const isDevTest = process.env.IS_DEV_TEST === "true"
const MOCK_API_WAIT_TIME = Number(process.env.MOCK_API_WAIT_TIME) || 500

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(appState: AppState) {
    this.appState = appState
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found in environment variables - running in limited mode")
      this.llmHelper = new LLMHelper('dummy-key') // Initialize with dummy key for limited functionality
    } else {
      this.llmHelper = new LLMHelper(apiKey)
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return

    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      // Check if last screenshot is an audio file
      const allPaths = this.appState.getScreenshotHelper().getScreenshotQueue();
      const lastPath = allPaths[allPaths.length - 1];
      if (lastPath.endsWith('.mp3') || lastPath.endsWith('.wav')) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START);
        this.appState.setView('solutions');
        try {
          const audioResult = await this.llmHelper.analyzeAudioFile(lastPath);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, audioResult);
          this.appState.setProblemInfo({ problem_statement: audioResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] });
          return;
        } catch (err: any) {
          console.error('Audio processing error:', err);
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, err.message);
          return;
        }
      }

      // NEW: Handle screenshot as plain text (like audio)
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")
      this.currentProcessingAbortController = new AbortController()
      try {
        // Check usage limits before processing (graceful degradation)
        const usageCheck = await this.checkAndIncrementUsage(1);
        if (!usageCheck.allowed) {
          console.warn('Usage limit exceeded for automatic screenshot processing:', usageCheck.error);
          // Continue with processing but warn user
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, usageCheck.error);
          return;
        }

        const imageResult = await this.llmHelper.analyzeImageFile(lastPath);
        const problemInfo = {
          problem_statement: imageResult.text,
          input_format: { description: "スクリーンショットから生成", parameters: [] as any[] },
          output_format: { description: "スクリーンショットから生成", type: "string", subtype: "text" },
          complexity: { time: "N/A", space: "N/A" },
          test_cases: [] as any[],
          validation_type: "manual",
          difficulty: "custom"
        };
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo);
        this.appState.setProblemInfo(problemInfo);
      } catch (error: any) {
        console.error("Image processing error:", error)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
      return;
    } else {
      // Debug mode
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        console.log("No extra screenshots to process")
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }

      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        // Check usage limits for 2 questions (generateSolution + debugSolutionWithImages)
        const usageCheck = await this.checkAndIncrementUsage(2);
        if (!usageCheck.allowed) {
          console.warn('Usage limit exceeded for debug processing:', usageCheck.error);
          // Continue with processing but warn user
          mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_ERROR, usageCheck.error);
          return;
        }

        // Get problem info and current solution
        const problemInfo = this.appState.getProblemInfo()
        if (!problemInfo) {
          throw new Error("No problem info available")
        }

        // Get current solution from state
        const currentSolution = await this.llmHelper.generateSolution(problemInfo)
        const currentCode = currentSolution.solution.code

        // Debug the solution using vision model
        const debugResult = await this.llmHelper.debugSolutionWithImages(
          problemInfo,
          currentCode,
          extraScreenshotQueue
        )

        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS,
          debugResult
        )

      } catch (error: any) {
        console.error("Debug processing error:", error)
        mainWindow.webContents.send(
          this.appState.PROCESSING_EVENTS.DEBUG_ERROR,
          error.message
        )
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests(): void {
    if (this.currentProcessingAbortController) {
      this.currentProcessingAbortController.abort()
      this.currentProcessingAbortController = null
    }

    if (this.currentExtraProcessingAbortController) {
      this.currentExtraProcessingAbortController.abort()
      this.currentExtraProcessingAbortController = null
    }

    this.appState.setHasDebugged(false)
  }

  public async processAudioBase64(data: string, mimeType: string, collectionId?: string) {
    // Directly use LLMHelper to analyze inline base64 audio with optional RAG
    return this.llmHelper.analyzeAudioFromBase64(data, mimeType, collectionId);
  }

  // Add audio file processing method
  public async processAudioFile(filePath: string, collectionId?: string) {
    return this.llmHelper.analyzeAudioFile(filePath, collectionId);
  }

  public getLLMHelper() {
    return this.llmHelper;
  }

  /**
   * Check usage limits and increment counter for Gemini API calls
   * @param questionCount Number of questions to be used (default: 1)
   * @returns Promise with success status and remaining count
   */
  public async checkAndIncrementUsage(questionCount: number = 1): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
    try {
      // Check if user is authenticated
      const user = this.appState.authService.getCurrentUser();
      const accessToken = this.appState.authService.getAccessToken();
      
      if (!user || !accessToken) {
        // If no authentication, allow the operation (guest mode)
        console.log('No authentication found, allowing operation without usage tracking');
        return { allowed: true };
      }

      // Check usage limits
      const usageCheck = await this.appState.usageTracker.checkCanAskQuestion(accessToken);
      if (!usageCheck.allowed) {
        return {
          allowed: false,
          error: usageCheck.error || 'Usage limit exceeded'
        };
      }
      
      // Check if we have enough remaining questions
      if (usageCheck.remaining !== undefined && usageCheck.remaining < questionCount) {
        return {
          allowed: false,
          error: `Insufficient usage remaining. This operation requires ${questionCount} questions but only ${usageCheck.remaining} remaining.`
        };
      }

      // Increment usage for each question
      for (let i = 0; i < questionCount; i++) {
        const usageResult = await this.appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn(`Usage tracking failed for increment ${i + 1}/${questionCount}:`, usageResult.error);
          // Continue with operation even if tracking fails
          break;
        }
      }

      return {
        allowed: true,
        remaining: usageCheck.remaining ? usageCheck.remaining - questionCount : undefined
      };
    } catch (error) {
      console.warn('Error in checkAndIncrementUsage (allowing operation to continue):', error);
      // Allow operation to continue even if usage tracking fails
      return {
        allowed: true,
        error: 'Usage tracking unavailable'
      };
    }
  }
}
