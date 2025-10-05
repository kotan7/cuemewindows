import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "./dialog";
import {
  Mic,
  Monitor,
  Shield,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface PermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionsCompleted: () => void;
}

interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined';
  screenCapture: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined';
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  isOpen,
  onOpenChange,
  onPermissionsCompleted,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<'welcome' | 'permissions' | 'completed'>('welcome');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: 'unknown',
    screenCapture: 'unknown'
  });
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Check initial permission status
  useEffect(() => {
    if (isOpen && currentStep === 'permissions') {
      checkPermissionStatus();
    }
  }, [isOpen, currentStep]);

  const checkPermissionStatus = async () => {
    try {
      setCheckingPermissions(true);
      const status = await window.electronAPI.invoke('permission-check-status');
      setPermissionStatus(status);
    } catch (err) {
      console.error('Error checking permission status:', err);
      setError('権限の確認に失敗しました');
    } finally {
      setCheckingPermissions(false);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setLoading(true);
      setError("");
      
      const result = await window.electronAPI.invoke('permission-request-microphone');
      
      if (result.granted) {
        setPermissionStatus(prev => ({ ...prev, microphone: 'granted' }));
      } else {
        setError(result.error || 'マイクの権限が拒否されました');
      }
      
      // Refresh status after request
      await checkPermissionStatus();
    } catch (err) {
      console.error('Error requesting microphone permission:', err);
      setError('マイクの権限リクエストに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const openSystemPreferences = async () => {
    try {
      setLoading(true);
      await window.electronAPI.invoke('permission-open-system-preferences');
    } catch (err) {
      console.error('Error opening system preferences:', err);
      setError('システム環境設定を開けませんでした');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      setLoading(true);
      
      // Mark initial setup as completed
      await window.electronAPI.invoke('permission-mark-setup-completed');
      
      // Close dialog and proceed to auth
      onPermissionsCompleted();
    } catch (err) {
      console.error('Error completing setup:', err);
      setError('セットアップの完了に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'denied':
      case 'restricted':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPermissionText = (status: string) => {
    switch (status) {
      case 'granted':
        return '許可済み';
      case 'denied':
        return '拒否済み';
      case 'restricted':
        return '制限あり';
      case 'not-determined':
        return '未設定';
      default:
        return '不明';
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <>
            {/* Header with Logo and Title */}
            <div className="flex flex-col items-center justify-center p-10 bg-gradient-to-b from-white/20 to-transparent">
              <div className="flex items-center gap-4 mb-6">
                <img src="./logogreen.png" alt="CueMe Logo" className="w-12 h-12" />
                <h1 className="text-3xl font-bold logo-text" style={{ color: "#013220" }}>
                  CueMe
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6" style={{ color: "#013220" }} />
                <h3 className="text-xl font-medium" style={{ color: "#013220" }}>
                  アプリの初期設定
                </h3>
              </div>
            </div>

            <div className="px-10 pb-10 space-y-8">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="text-center space-y-4">
                <p className="text-lg font-medium" style={{ color: "#013220" }}>
                  CueMeへようこそ！
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  音声による質問分析やスクリーンショット解析を使用するため、<br />
                  いくつかのシステム権限が必要です。<br />
                  次のステップで権限を設定しましょう。
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-white/50 rounded-xl">
                  <Mic className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm" style={{ color: "#013220" }}>
                      マイクアクセス
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      音声による質問の検出と分析に使用します
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-white/50 rounded-xl">
                  <Monitor className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm" style={{ color: "#013220" }}>
                      画面収録
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      システム音声の取得とスクリーンショット機能に使用します
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep('permissions')}
                disabled={loading}
                className="w-full px-6 py-4 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 border-0 hover:opacity-90 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
                style={{ backgroundColor: "#013220" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    権限を設定する
                  </>
                )}
              </button>
            </div>
          </>
        );

      case 'permissions':
        return (
          <>
            {/* Header with Logo and Title */}
            <div className="flex flex-col items-center justify-center p-10 bg-gradient-to-b from-white/20 to-transparent">
              <div className="flex items-center gap-4 mb-6">
                <img src="./logogreen.png" alt="CueMe Logo" className="w-12 h-12" />
                <h1 className="text-3xl font-bold logo-text" style={{ color: "#013220" }}>
                  CueMe
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6" style={{ color: "#013220" }} />
                <h3 className="text-xl font-medium" style={{ color: "#013220" }}>
                  権限の設定
                </h3>
              </div>
            </div>

            <div className="px-10 pb-10 space-y-8">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {checkingPermissions ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "#013220" }} />
                  <p className="text-gray-600 text-sm">権限を確認中...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Microphone Permission */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Mic className="w-5 h-5 text-blue-500" />
                        <div>
                          <div className="font-medium text-sm" style={{ color: "#013220" }}>
                            マイクアクセス
                          </div>
                          <div className="text-xs text-gray-600">
                            音声質問の検出に必要
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPermissionIcon(permissionStatus.microphone)}
                        <span className="text-xs text-gray-600">
                          {getPermissionText(permissionStatus.microphone)}
                        </span>
                      </div>
                    </div>

                    {permissionStatus.microphone !== 'granted' && (
                      <button
                        onClick={requestMicrophonePermission}
                        disabled={loading}
                        className="w-full px-4 py-2 text-sm bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 rounded-xl transition-all duration-200 font-medium border border-blue-200"
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          'マイクの権限を許可'
                        )}
                      </button>
                    )}
                  </div>

                  {/* Screen Recording Permission */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5 text-green-500" />
                        <div>
                          <div className="font-medium text-sm" style={{ color: "#013220" }}>
                            画面収録
                          </div>
                          <div className="text-xs text-gray-600">
                            システム音声とスクリーンショットに必要
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPermissionIcon(permissionStatus.screenCapture)}
                        <span className="text-xs text-gray-600">
                          {getPermissionText(permissionStatus.screenCapture)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={openSystemPreferences}
                      disabled={loading}
                      className="w-full px-4 py-2 text-sm bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed text-green-700 rounded-xl transition-all duration-200 font-medium border border-green-200"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        'システム環境設定を開く'
                      )}
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-yellow-800">
                        <div className="font-medium mb-1">macOSでの設定方法:</div>
                        <ul className="space-y-1 list-disc list-inside ml-2">
                          <li>システム環境設定 → セキュリティとプライバシー → マイク</li>
                          <li>システム環境設定 → セキュリティとプライバシー → 画面収録</li>
                          <li>CueMeアプリにチェックを入れて有効にしてください</li>
                          <li>設定後はアプリを再起動することをお勧めします</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Refresh and Continue buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={checkPermissionStatus}
                      disabled={loading || checkingPermissions}
                      className="flex-1 px-4 py-3 text-sm bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-xl transition-all duration-200 font-medium border border-gray-200"
                    >
                      状態を更新
                    </button>
                    
                    <button
                      onClick={handleCompleteSetup}
                      disabled={loading}
                      className="flex-1 px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 border-0 hover:opacity-90"
                      style={{ backgroundColor: "#013220" }}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        '設定を完了'
                      )}
                    </button>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500">
                      権限は後からでも変更可能です。まずはアプリを体験してみましょう。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
        style={{ backgroundColor: "#F7F7EE" }}
      >
        {getStepContent()}
      </DialogContent>
    </Dialog>
  );
};