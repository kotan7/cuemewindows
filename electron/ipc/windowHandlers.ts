import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Window management IPC handlers
 * Handles window positioning, dimensions, and visibility
 */
export function registerWindowHandlers(appState: AppState): void {
  // Update window dimensions based on content size
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height);
      }
    }
  );

  // Toggle window visibility
  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow();
  });

  // Move window left
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft();
  });

  // Move window right
  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight();
  });

  // Move window up
  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp();
  });

  // Move window down
  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown();
  });

  // Center and show window
  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow();
  });

  // Quit application
  ipcMain.handle("quit-app", () => {
    appState.cleanupWindow();
    require("electron").app.quit();
  });
}
