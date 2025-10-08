import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Screenshot management IPC handlers
 * Handles screenshot capture, retrieval, and deletion
 */
export function registerScreenshotHandlers(appState: AppState): void {
  // Take a new screenshot
  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot();
      const preview = await appState.getImagePreview(screenshotPath);
      return { path: screenshotPath, preview };
    } catch (error) {
      console.error("Error taking screenshot:", error);
      throw error;
    }
  });

  // Get all screenshots for current view
  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() });
    try {
      let previews = [];
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        );
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        );
      }
      previews.forEach((preview: any) => console.log(preview.path));
      return previews;
    } catch (error) {
      console.error("Error getting screenshots:", error);
      throw error;
    }
  });

  // Delete a specific screenshot
  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path);
  });

  // Reset/clear all screenshot queues
  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues();
      console.log("Screenshot queues have been cleared.");
      return { success: true };
    } catch (error: any) {
      console.error("Error resetting queues:", error);
      return { success: false, error: error.message };
    }
  });
}
