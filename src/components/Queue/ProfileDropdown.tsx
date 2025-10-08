import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, Shield } from 'lucide-react';
import { AudioSettings } from '../AudioSettings';
import { ProfileModeSelector } from './ProfileModeSelector';

interface ProfileDropdownProps {
  currentMode: string;
  onModeChange: (mode: string) => void;
  currentAudioSource: any;
  onAudioSourceChange: (sourceId: string) => void;
  isListening: boolean;
  audioError: string | null;
  onLogout: () => Promise<void>;
  onSettings: () => void;
  onPermissionRequest: () => Promise<void>;
}

/**
 * Profile dropdown menu with mode selector, audio settings, and user actions
 */
export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  currentMode,
  onModeChange,
  currentAudioSource,
  onAudioSourceChange,
  isListening,
  audioError,
  onLogout,
  onSettings,
  onPermissionRequest,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        !(event.target as Element)?.closest('.profile-dropdown-container')
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await onLogout();
    setIsOpen(false);
  };

  const handleSettings = () => {
    onSettings();
    setIsOpen(false);
  };

  const handlePermissionRequest = async () => {
    await onPermissionRequest();
    setIsOpen(false);
  };

  return (
    <div className="absolute top-0 right-0 transform translate-x-full mt-1 pl-2">
      <div className="relative profile-dropdown-container">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-black/60 hover:bg-black/70 border border-white/25"
          type="button"
          title="プロフィール"
        >
          <User className="w-4 h-4 text-emerald-800" />
        </button>

        {/* Profile Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-4 w-64 morphism-dropdown shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="py-1">
              {/* Answer Mode Section */}
              <div className="px-3 py-2 border-b border-white/10">
                <div className="text-xs text-white/60 mb-2">回答モード</div>
                <ProfileModeSelector
                  currentMode={currentMode}
                  onModeChange={onModeChange}
                />
              </div>

              {/* Audio Settings Section */}
              <div className="px-3 py-2 border-b border-white/10">
                <div className="text-xs text-white/60 mb-2">
                  オーディオ設定
                </div>
                <AudioSettings
                  currentSource={currentAudioSource}
                  onSourceChange={onAudioSourceChange}
                  disabled={isListening}
                  isListening={isListening}
                  error={audioError}
                />
              </div>

              <button
                onClick={handlePermissionRequest}
                className="w-full px-3 py-2 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors rounded-md"
              >
                <Shield className="w-3 h-3" />
                権限を許可
              </button>
              <button
                onClick={handleSettings}
                className="w-full px-3 py-2 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors rounded-md"
              >
                <Settings className="w-3 h-3" />
                設定
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors rounded-md"
              >
                <LogOut className="w-3 h-3" />
                ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
