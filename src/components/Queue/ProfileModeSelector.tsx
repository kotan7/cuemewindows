import React, { useState, useEffect } from 'react';
import {
  Target,
  FileText,
  Briefcase,
  Scale,
  BookOpen,
  Phone,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { ModeOption } from '../../types/modes';

interface ProfileModeSelectorProps {
  currentMode: string;
  onModeChange: (modeKey: string) => void;
}

/**
 * Compact mode selector for the profile dropdown
 */
export const ProfileModeSelector: React.FC<ProfileModeSelectorProps> = ({
  currentMode,
  onModeChange,
}) => {
  const [availableModes, setAvailableModes] = useState<ModeOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadAvailableModes();
  }, []);

  const loadAvailableModes = async () => {
    try {
      const modes = await window.electronAPI.invoke('get-available-modes');
      // Filter to show only the most common modes
      const compactModes = [
        'interview',
        'meeting',
        'sales',
        'telesales',
        'support',
      ];
      const filteredModes = modes.filter((mode: ModeOption) =>
        compactModes.includes(mode.key)
      );
      setAvailableModes(filteredModes);
    } catch (error) {
      console.error('Failed to load available modes:', error);
    }
  };

  const getModeIcon = (modeKey: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      interview: Target,
      meeting: FileText,
      sales: Briefcase,
      debate: Scale,
      class: BookOpen,
      telesales: Phone,
      support: Wrench,
    };
    return iconMap[modeKey] || MessageSquare;
  };

  const currentModeData = availableModes.find(
    (mode) => mode.key === currentMode
  );
  const CurrentIcon = getModeIcon(currentMode);

  return (
    <div className="relative">
      {/* Current Mode Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2 py-1.5 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-between transition-colors rounded-md"
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className="w-3 h-3" />
          <span>
            {currentModeData?.displayName
              ?.replace('モード', '')
              .replace('（候補者）', '')
              .replace('（提案）', '')
              .replace('（高応答）', '') || currentMode}
          </span>
        </div>
        <svg
          className={`w-3 h-3 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-0 right-full mr-6 w-32 morphism-dropdown shadow-lg z-20 max-h-48 overflow-y-auto">
            {availableModes.map((mode) => {
              const Icon = getModeIcon(mode.key);
              return (
                <button
                  key={mode.key}
                  onClick={() => {
                    onModeChange(mode.key);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-white/10 focus:outline-none focus:bg-white/10 transition-colors flex items-center gap-2 ${
                    mode.key === currentMode
                      ? 'text-white bg-white/10'
                      : 'text-white/80'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <div>
                    <div className="font-medium">
                      {mode.displayName
                        .replace('モード', '')
                        .replace('（候補者）', '')
                        .replace('（提案）', '')
                        .replace('（高応答）', '')}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
