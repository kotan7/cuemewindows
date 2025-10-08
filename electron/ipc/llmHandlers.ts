import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * LLM and AI processing IPC handlers
 * Handles Gemini chat, RAG, modes, and image analysis
 */
export function registerLLMHandlers(appState: AppState): void {
  // Analyze image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path);
      return result;
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error);
      throw error;
    }
  });

  // Basic Gemini chat
  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithGemini(message);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error);
      throw error;
    }
  });

  // Mode-enabled chat handler
  ipcMain.handle("gemini-chat-mode", async (event, message: string, modeKey: string = 'interview', collectionId?: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithMode(message, modeKey, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-mode handler:", error);
      throw error;
    }
  });

  // Get available modes
  ipcMain.handle("get-available-modes", async () => {
    try {
      return appState.processingHelper.getLLMHelper().getModeManager().getModeOptions();
    } catch (error: any) {
      console.error("Error in get-available-modes handler:", error);
      throw error;
    }
  });

  // RAG-enabled chat handler
  ipcMain.handle("gemini-chat-rag", async (event, message: string, collectionId?: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithRAG(message, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-rag handler:", error);
      throw error;
    }
  });
}
