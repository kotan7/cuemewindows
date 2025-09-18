// ipcHandlers.ts

import { ipcMain, app, shell } from "electron"
import { AppState } from "./main"

export function initializeIpcHandlers(appState: AppState): void {
  // Debug logging handler to show frontend logs in terminal
  ipcMain.handle("debug-log", async (event, message: string) => {
    console.log('[Frontend Debug]', message);
    return { success: true };
  });

  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string, collectionId?: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits for 1 question (audio analysis counts as 1 user question)
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          // Create a specific error type for usage limits
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }
        
        // Check if we can use 1 question (audio analysis counts as 1 user question)
        if (usageCheck.remaining !== undefined && usageCheck.remaining < 1) {
          const error = new Error(`Insufficient usage remaining. This operation requires 1 question but only ${usageCheck.remaining} remaining.`);
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining;
          throw error;
        }

        // Increment usage by 1 (audio analysis counts as 1 user question)
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken, 1);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
          // Don't throw error - allow the request to continue for tracking failures (not limit exceeded)
        }
      }

      const result = await appState.processingHelper.processAudioBase64(data, mimeType, collectionId)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string, collectionId?: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits for 1 question (audio analysis counts as 1 user question)
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          // Create a specific error type for usage limits
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }
        
        // Check if we can use 1 question (audio analysis counts as 1 user question)
        if (usageCheck.remaining !== undefined && usageCheck.remaining < 1) {
          const error = new Error(`Insufficient usage remaining. This operation requires 1 question but only ${usageCheck.remaining} remaining.`);
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining;
          throw error;
        }

        // Increment usage by 1 (audio analysis counts as 1 user question)
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken, 1);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
          // Don't throw error - allow the request to continue for tracking failures (not limit exceeded)
        }
      }

      const result = await appState.processingHelper.processAudioFile(path, collectionId)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits and increment if allowed
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          // Create a specific error type for usage limits
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        // Increment usage before processing
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
          // Don't throw error - allow the request to continue for tracking failures (not limit exceeded)
        }
      }

      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits and increment if allowed
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          // Create a specific error type for usage limits
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        // Increment usage before processing
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
          // Don't throw error - allow the request to continue for tracking failures (not limit exceeded)
        }
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithGemini(message);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error);
      throw error;
    }
  });

  // RAG-enabled chat handler
  ipcMain.handle("gemini-chat-rag", async (event, message: string, collectionId?: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits and increment if allowed
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          // Create a specific error type for usage limits
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        // Increment usage before processing
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
          // Don't throw error - allow the request to continue for tracking failures (not limit exceeded)
        }
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithRAG(message, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-rag handler:", error);
      throw error;
    }
  });

  // Authentication handlers
  ipcMain.handle("auth-sign-in", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signInWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-in handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-sign-up", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signUpWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-up handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-sign-out", async () => {
    try {
      return await appState.authService.signOut();
    } catch (error: any) {
      console.error("Error in auth-sign-out handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-get-state", async () => {
    try {
      return appState.authService.getAuthState();
    } catch (error: any) {
      console.error("Error in auth-get-state handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-reset-password", async (event, email: string) => {
    try {
      return await appState.authService.resetPassword(email);
    } catch (error: any) {
      console.error("Error in auth-reset-password handler:", error);
      throw error;
    }
  });

  // QnA Collection handlers
  ipcMain.handle("qna-get-collections", async () => {
    try {
      const user = appState.authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      return await appState.qnaService.getUserCollections(user.id);
    } catch (error: any) {
      console.error("Error in qna-get-collections handler:", error);
      throw error;
    }
  });

  // Document handlers
  ipcMain.handle("documents-get-user-documents", async () => {
    try {
      const user = appState.authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      return await appState.documentService.getUserDocuments(user.id);
    } catch (error: any) {
      console.error("Error in documents-get-user-documents handler:", error);
      throw error;
    }
  });



  ipcMain.handle("qna-get-collection", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollection(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-get-collection-items", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollectionItems(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection-items handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-search-items", async (event, query: string, collectionId: string, threshold?: number, count?: number) => {
    try {
      return await appState.qnaService.searchQnAItems(query, collectionId, threshold, count);
    } catch (error: any) {
      console.error("Error in qna-search-items handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-find-relevant", async (event, question: string, collectionId: string, threshold?: number) => {
    try {
      return await appState.qnaService.findRelevantAnswers(question, collectionId, threshold);
    } catch (error: any) {
      console.error("Error in qna-find-relevant handler:", error);
      throw error;
    }
  });

  ipcMain.handle("open-external-url", async (event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error("Error opening external URL:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("quit-app", () => {
    appState.cleanupWindow()
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })

  // Audio Stream Processing handlers
  ipcMain.handle("audio-stream-start", async () => {
    try {
      await appState.audioStreamProcessor.startListening();
      return { success: true };
    } catch (error: any) {
      console.error("Error starting audio stream:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-stop", async () => {
    try {
      await appState.audioStreamProcessor.stopListening();
      return { success: true };
    } catch (error: any) {
      console.error("Error stopping audio stream:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-process-chunk", async (event, audioData: Float32Array) => {
    try {
      console.log('[IPC] Received audio chunk, samples:', audioData.length);
      
      // Convert Float32Array to Buffer for AudioStreamProcessor
      const buffer = Buffer.alloc(audioData.length * 2);
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        buffer.writeInt16LE(sample, i * 2);
      }
      
      await appState.audioStreamProcessor.processAudioChunk(buffer);
      return { success: true };
    } catch (error: any) {
      console.error("Error processing audio chunk:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-get-state", async () => {
    try {
      return appState.audioStreamProcessor.getState();
    } catch (error: any) {
      console.error("Error getting audio stream state:", error);
      throw error;
    }
  });

  ipcMain.handle("audio-stream-get-questions", async () => {
    try {
      return appState.audioStreamProcessor.getQuestions();
    } catch (error: any) {
      console.error("Error getting detected questions:", error);
      throw error;
    }
  });

  ipcMain.handle("audio-stream-clear-questions", async () => {
    try {
      appState.audioStreamProcessor.clearQuestions();
      return { success: true };
    } catch (error: any) {
      console.error("Error clearing questions:", error);
      return { success: false, error: error.message };
    }
  });

  // Handler for generating answers to detected questions using existing RAG system
  ipcMain.handle("audio-stream-answer-question", async (event, questionText: string, collectionId?: string) => {
    try {
      // Check if user is authenticated and try usage tracking
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits and increment if allowed
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        // Increment usage before processing
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      // Use existing LLM helper with RAG if collection ID provided
      let result;
      if (collectionId && appState.processingHelper.getLLMHelper()) {
        result = await appState.processingHelper.getLLMHelper().chatWithRAG(questionText, collectionId);
      } else {
        result = await appState.processingHelper.getLLMHelper().chatWithGemini(questionText);
      }
      
      // Handle different return types: string (chatWithGemini) or object (chatWithRAG)
      const response = typeof result === 'string' ? result : result.response;
      return { response, timestamp: Date.now() };
    } catch (error: any) {
      console.error("Error answering question:", error);
      throw error;
    }
  });
}
