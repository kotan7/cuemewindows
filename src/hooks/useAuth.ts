import { useState, useEffect } from 'react';

export interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
}

export interface AuthHandlers {
  handleSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  handleSignUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  handleResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  handleSignOut: () => Promise<{ success: boolean; error?: string }>;
}

/**
 * Custom hook for managing authentication state and handlers
 */
export function useAuth(queryClient?: any): [AuthState, AuthHandlers] {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialState = await window.electronAPI.authGetState();
        setAuthState(initialState);
      } catch (error) {
        console.error('Error getting initial auth state:', error);
        setAuthState({ user: null, session: null, isLoading: false });
      }
    };

    initAuth();

    // Listen for auth state changes
    const cleanup = window.electronAPI.onAuthStateChange((state) => {
      setAuthState(state);
      if (state.user && !state.isLoading) {
        console.log('User signed in successfully');
      }
    });

    return cleanup;
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    try {
      return await window.electronAPI.authSignIn(email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'Sign in failed' };
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      return await window.electronAPI.authSignUp(email, password);
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'Sign up failed' };
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      return await window.electronAPI.authResetPassword(email);
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, error: 'Password reset failed' };
    }
  };

  const handleSignOut = async () => {
    try {
      const result = await window.electronAPI.authSignOut();
      if (result.success && queryClient) {
        // Clear all queries when signing out
        queryClient.clear();
      }
      return result;
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: 'Sign out failed' };
    }
  };

  return [
    authState,
    {
      handleSignIn,
      handleSignUp,
      handleResetPassword,
      handleSignOut,
    },
  ];
}
