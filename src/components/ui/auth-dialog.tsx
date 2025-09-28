import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "./dialog";
import {
  User,
  Loader2,
  LogOut,
  LogIn,
  ExternalLink,
  Copy,
  CheckCircle,
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
  const [copied, setCopied] = useState(false);
  
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
  
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };
  
  // Test with cueme:// protocol callback (production approach)
  const handleTestProtocolCallback = async () => {
    try {
      console.log('[AuthDialog] Testing cueme:// protocol callback...')
      
      // Use properly formatted JWT-like tokens for testing
      const testAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      const testRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgUmVmcmVzaCIsImlhdCI6MTUxNjIzOTAyMn0.XYZ123abc456def789ghi012jkl345mno678pqr901stu234vwx567yz890'
      
      const testUrl = `cueme://auth-callback#access_token=${testAccessToken}&refresh_token=${testRefreshToken}&token_type=bearer`
      
      console.log('[AuthDialog] Opening test cueme:// callback URL...')
      const result = await window.electronAPI.invoke('test-deep-link', testUrl, true)
      
      if (result.success) {
        alert('✅ cueme:// protocol callback test initiated!\n\nThis should trigger authentication in the Electron app.\nCheck the terminal for detailed results.')
      } else {
        alert('❌ cueme:// protocol callback test failed: ' + result.error)
      }
    } catch (error) {
      console.error('[AuthDialog] Error testing cueme:// protocol callback:', error)
      alert('❌ Error testing cueme:// protocol callback: ' + error)
    }
  };
  
  // Check protocol handler status
  const handleCheckProtocol = async () => {
    try {
      console.log('[AuthDialog] Checking protocol handler status...')
      const result = await window.electronAPI.invoke('check-protocol-handler')
      console.log('[AuthDialog] Protocol handler status:', result)
      alert(`Protocol Handler Status:\n\nIs Default: ${result.isDefault}\nPlatform: ${result.platform}\nSuccess: ${result.success}${result.error ? `\nError: ${result.error}` : ''}`)
    } catch (error) {
      console.error('[AuthDialog] Error checking protocol handler:', error)
    }
  };
  
  // Test with real tokens (user provides them)
  const handleTestRealTokens = async () => {
    try {
      const accessToken = prompt('Enter access_token from a real login session:')
      const refreshToken = prompt('Enter refresh_token from a real login session:')
      
      if (!accessToken || !refreshToken) {
        alert('Both tokens are required for testing')
        return
      }
      
      console.log('[AuthDialog] Testing with real tokens...')
      const testUrl = `cueme://auth-callback#access_token=${accessToken}&refresh_token=${refreshToken}&token_type=bearer`
      
      // Test in real mode (goes through Supabase validation)
      const result = await window.electronAPI.invoke('test-deep-link', testUrl, false)
      console.log('[AuthDialog] Real token test result:', result)
      
      if (result.success) {
        alert('✅ Real token test initiated!\n\nCheck the terminal for detailed results.')
      } else {
        alert('❌ Real token test failed: ' + result.error)
      }
    } catch (error) {
      console.error('[AuthDialog] Error testing real tokens:', error)
      alert('❌ Error testing real tokens: ' + error)
    }
  };
  
  // Manual terminal test (Option B)
  const handleManualTerminalTest = async () => {
    try {
      console.log('[AuthDialog] Starting manual terminal test...')
      
      // First register the protocol to ensure it's set up
      console.log('[AuthDialog] Ensuring protocol is registered...')
      await window.electronAPI.invoke('register-protocol-handler')
      
      // Show instructions for manual testing
      const instructions = `🖥️ Manual Protocol Handler Test

1. Open Terminal (Command + Space, type "Terminal")
2. Copy and paste this command:
   open "cueme://manual-test"
3. Press Enter

What should happen:
✅ The Electron app should receive the deep link
✅ You should see logs in the terminal
❌ If nothing happens, the protocol handler isn't working

Ready to test?`
      
      const proceed = confirm(instructions)
      
      if (proceed) {
        // Copy the command to clipboard for easy use
        try {
          await navigator.clipboard.writeText('open "cueme://manual-test"')
          alert('✅ Command copied to clipboard!\n\nNow:\n1. Open Terminal\n2. Paste (Cmd+V) and press Enter\n3. Watch the app terminal for logs')
        } catch (clipboardError) {
          alert('✅ Ready to test!\n\nIn Terminal, run:\nopen "cueme://manual-test"\n\nThen watch the app terminal for logs')
        }
      }
    } catch (error) {
      console.error('[AuthDialog] Error in manual terminal test:', error)
      alert('❌ Error setting up manual test: ' + error)
    }
  };
  
  // Register protocol handler
  const handleRegisterProtocol = async () => {
    try {
      console.log('[AuthDialog] Registering protocol handler...')
      const result = await window.electronAPI.invoke('register-protocol-handler')
      console.log('[AuthDialog] Protocol registration result:', result)
      
      if (result.success) {
        let message = `Registration Results:\n\n`
        message += `✅ Registration API call: ${result.registered ? 'Success' : 'Failed'}\n`
        message += `✅ Verification check: ${result.verified ? 'Success' : 'Failed'}\n`
        message += `Platform: ${result.platform}\n`
        
        if (result.verified) {
          message += `\n🎉 Protocol handler successfully registered!`
        } else {
          message += `\n⚠️ Automatic registration completed but verification failed.`
          if (result.manualInstructions) {
            message += result.manualInstructions
          }
        }
        
        alert(message)
      } else {
        alert(`❌ Protocol registration failed\n\nError: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[AuthDialog] Error registering protocol handler:', error)
      alert('❌ Error registering protocol handler: ' + error)
    }
  };
  
  return (
    <div className="space-y-2">
      <button
        onClick={handleOpenWeb}
        disabled={loading}
        className="w-full px-4 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border-0 hover:opacity-90 flex items-center justify-center gap-2"
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
      
      <div className="flex space-x-2">
        <button
          onClick={handleCopyUrl}
          className="flex-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-center gap-1"
        >
          {copied ? (
            <>
              <CheckCircle className="w-3 h-3" />
              コピーしました
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              URLをコピー
            </>
          )}
        </button>
        
        {process.env.NODE_ENV === 'development' && (
          <>
            <button
              onClick={handleTestProtocolCallback}
              className="flex-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center justify-center gap-1"
              title="Test HTTP callback authentication"
            >
              🔗 HTTPテスト
            </button>
            <button
              onClick={handleManualTerminalTest}
              className="flex-1 px-2 py-1 text-xs text-green-600 hover:text-green-800 transition-colors flex items-center justify-center gap-1"
              title="Test protocol handler with Terminal"
            >
              🖥️ 手動確認
            </button>
          </>
        )}
      </div>
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
          className="w-96 max-w-md border-0 rounded-2xl p-0 overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#F7F7EE" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-300">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5" style={{ color: "#013220" }} />
              <h3 className="text-xl font-bold" style={{ color: "#013220" }}>
                ユーザーアカウント
              </h3>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-black">
              <User className="w-5 h-5" style={{ color: "#013220" }} />
              <span className="text-sm truncate">{authState.user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full px-4 py-3 text-sm bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 rounded-lg transition-colors font-medium border border-red-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
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
        className="w-96 max-w-md border-0 rounded-2xl p-0 overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#F7F7EE" }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <LogIn className="w-5 h-5" style={{ color: "#013220" }} />
            <h3 className="text-xl font-bold" style={{ color: "#013220" }}>
              ログイン
            </h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-gray-700 text-sm">
              ブラウザでログインしてください。
            </p>
            <p className="text-gray-600 text-xs">
              ログイン後、自動的にアプリに戻ります。
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
