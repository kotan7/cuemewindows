import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "./dialog";
import {
  User,
  Loader2,
  LogOut,
  LogIn,
  ExternalLink,
} from "lucide-react";

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
}

interface AuthDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  authState: AuthState;
  onSignIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignOut: () => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
}

// Web login button component
const WebLoginButton: React.FC<{
  type: 'login' | 'signup';
  loading: boolean;
  onLoading: (loading: boolean) => void;
  onError: (error: string) => void;
}> = ({ type, loading, onLoading, onError }) => {
  
  // Use production domain for browser login in all cases
  const baseUrl = 'https://www.cueme.ink';
  // Always use domain-based callback endpoint for Electron
  const callbackUrl = 'https://www.cueme.ink/auth/electron-callback';
  const webUrl = `${baseUrl}/${type}?redirect_to=${encodeURIComponent(callbackUrl)}`;
  
  const handleOpenWeb = async () => {
    try {
      console.log('[AuthDialog] Opening web browser for authentication...')
      console.log('[AuthDialog] - Type:', type)
      console.log('[AuthDialog] - Base URL:', baseUrl)
      console.log('[AuthDialog] - Callback URL:', callbackUrl)
      console.log('[AuthDialog] - Full web URL:', webUrl)
      
      onLoading(true)
      
      console.log('[AuthDialog] Calling open-external-url IPC...')
      const result = await window.electronAPI.invoke('open-external-url', webUrl)
      
      console.log('[AuthDialog] open-external-url result:', result)
      
      if (!result.success) {
        console.error('[AuthDialog] Failed to open URL:', result.error)
        onError('ブラウザを開けませんでした: ' + (result.error || 'Unknown error'))
        return
      }
      
      console.log('[AuthDialog] External URL opened successfully')
      
      // Hide the electron window after opening browser
      console.log('[AuthDialog] Hiding electron window...')
      const toggleResult = await window.electronAPI.invoke('toggle-window')
      console.log('[AuthDialog] toggle-window result:', toggleResult)
      
    } catch (error) {
      console.error('[AuthDialog] Error in handleOpenWeb:', error)
      onError('ブラウザを開けませんでした。手動でアクセスしてください。')
    } finally {
      onLoading(false)
    }
  };
  
  return (
    <div>
      <button
        onClick={handleOpenWeb}
        disabled={loading}
        className="w-full px-6 py-4 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 border-0 hover:opacity-90 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
        style={{ backgroundColor: type === 'login' ? "#013220" : "#065f46" }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            {type === 'login' ? 'ブラウザでログイン' : 'ブラウザでアカウント作成'}
          </>
        )}
      </button>
    </div>
  );
};

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onOpenChange,
  authState,
  onSignOut,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setError("");
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const result = await onSignOut();
      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "ログアウトに失敗しました");
      }
    } catch (err) {
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (authState.user) {
    // User is authenticated - show simple confirmation dialog
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogRef}
          className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
          style={{ backgroundColor: "#F7F7EE" }}
        >
          {/* Header with Logo and Title */}
          <div className="flex flex-col items-center justify-center p-10 bg-gradient-to-b from-white/20 to-transparent">
            <div className="flex items-center gap-4 mb-6">
              <img src="./logogreen.png" alt="CueMe Logo" className="w-12 h-12" />
              <h1 className="text-3xl font-bold logo-text" style={{ color: "#013220" }}>
                CueMe
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <User className="w-6 h-6" style={{ color: "#013220" }} />
              <h3 className="text-xl font-medium" style={{ color: "#013220" }}>
                ユーザーアカウント
              </h3>
            </div>
          </div>

          <div className="px-10 pb-10 space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-black bg-white/30 rounded-xl p-4">
              <User className="w-6 h-6" style={{ color: "#013220" }} />
              <span className="text-base font-medium truncate">{authState.user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full px-6 py-4 text-base bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 rounded-xl transition-all duration-200 font-medium border border-red-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  ログアウト
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // User is not authenticated - show web login redirect dialog
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
        style={{ backgroundColor: "#F7F7EE" }}
      >
        {/* Header with Logo and Title */}
        <div className="flex flex-col items-center justify-center p-10 bg-gradient-to-b from-white/20 to-transparent">
          <div className="flex items-center gap-4 mb-6">
            <img src="./logogreen.png" alt="CueMe Logo" className="w-12 h-12" />
            <h1 className="text-3xl font-bold logo-text" style={{ color: "#013220" }}>
              CueMe
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LogIn className="w-6 h-6" style={{ color: "#013220" }} />
            <h3 className="text-xl font-medium" style={{ color: "#013220" }}>
              ログイン
            </h3>
          </div>
        </div>

        <div className="px-10 pb-10 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <WebLoginButton
              type="login"
              loading={loading}
              onLoading={setLoading}
              onError={setError}
            />
            
            <WebLoginButton
              type="signup"
              loading={loading}
              onLoading={setLoading}
              onError={setError}
            />
          </div>

          <div className="text-center space-y-2 mt-6">
            <p className="text-gray-600 text-sm">
              ブラウザでログインしてください
            </p>
            <p className="text-gray-500 text-xs">
              ログイン後、自動的にアプリに戻ります
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
