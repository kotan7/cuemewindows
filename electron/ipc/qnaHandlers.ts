import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Q&A Collection IPC handlers
 * Handles Q&A collection management and search
 */
export function registerQnAHandlers(appState: AppState): void {
  // Get all collections for current user
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

  // Get a specific collection
  ipcMain.handle("qna-get-collection", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollection(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection handler:", error);
      throw error;
    }
  });

  // Get items in a collection
  ipcMain.handle("qna-get-collection-items", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollectionItems(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection-items handler:", error);
      throw error;
    }
  });

  // Search items in a collection
  ipcMain.handle("qna-search-items", async (event, query: string, collectionId: string, threshold?: number, count?: number) => {
    try {
      return await appState.qnaService.searchQnAItems(query, collectionId, threshold, count);
    } catch (error: any) {
      console.error("Error in qna-search-items handler:", error);
      throw error;
    }
  });

  // Find relevant answers for a question
  ipcMain.handle("qna-find-relevant", async (event, question: string, collectionId: string, threshold?: number) => {
    try {
      return await appState.qnaService.findRelevantAnswers(question, collectionId, threshold);
    } catch (error: any) {
      console.error("Error in qna-find-relevant handler:", error);
      throw error;
    }
  });
}
