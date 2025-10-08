import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Authentication IPC handlers
 * Handles user sign in, sign up, sign out, and password reset
 */
export function registerAuthHandlers(appState: AppState): void {
  // Sign in with email and password
  ipcMain.handle("auth-sign-in", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signInWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-in handler:", error);
      throw error;
    }
  });

  // Sign up with email and password
  ipcMain.handle("auth-sign-up", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signUpWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-up handler:", error);
      throw error;
    }
  });

  // Sign out
  ipcMain.handle("auth-sign-out", async () => {
    try {
      return await appState.authService.signOut();
    } catch (error: any) {
      console.error("Error in auth-sign-out handler:", error);
      throw error;
    }
  });

  // Get current auth state
  ipcMain.handle("auth-get-state", async () => {
    try {
      return appState.authService.getAuthState();
    } catch (error: any) {
      console.error("Error in auth-get-state handler:", error);
      throw error;
    }
  });

  // Reset password
  ipcMain.handle("auth-reset-password", async (event, email: string) => {
    try {
      return await appState.authService.resetPassword(email);
    } catch (error: any) {
      console.error("Error in auth-reset-password handler:", error);
      throw error;
    }
  });
}
