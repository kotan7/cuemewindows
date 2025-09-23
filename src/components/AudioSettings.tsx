import React, { useState, useEffect } from "react";
import {
  Mic,
  Monitor,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Settings,
} from "lucide-react";

// Audio source type to match backend
interface AudioSource {
  id: string;
  name: string;
  type: "microphone" | "system";
  available: boolean;
}

interface AudioSettingsProps {
  currentSource?: AudioSource | null;
  onSourceChange: (sourceId: string) => void;
  disabled?: boolean;
  isListening: boolean;
  error?: string | null;
  className?: string;
}

export const AudioSettings: React.FC<AudioSettingsProps> = ({
  currentSource,
  onSourceChange,
  disabled = false,
  isListening,
  error,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sources, setSources] = useState<AudioSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Load available audio sources
  useEffect(() => {
    loadAudioSources();
  }, []);

  const loadAudioSources = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.audioGetSources();

      if (result.success) {
        setSources(result.sources);
        console.log("[AudioSettings] Loaded audio sources:", result.sources);
      } else {
        console.error("[AudioSettings] Failed to load sources:", result.error);
      }
    } catch (err) {
      console.error("[AudioSettings] Error loading sources:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceSelect = async (sourceId: string) => {
    try {
      setIsOpen(false);

      // Don't switch if it's the same source
      if (currentSource?.id === sourceId) {
        return;
      }

      console.log("[AudioSettings] Switching to source:", sourceId);
      onSourceChange(sourceId);
    } catch (err) {
      console.error("[AudioSettings] Error switching source:", err);
    }
  };

  const requestPermissions = async () => {
    try {
      console.log("[AudioSettings] Requesting audio permissions...");

      const result = await window.electronAPI.audioRequestPermissions();

      if (result.granted) {
        console.log("[AudioSettings] Permissions granted, reloading sources");
        await loadAudioSources();
      } else {
        console.error("[AudioSettings] Permissions denied:", result.error);
      }
    } catch (err) {
      console.error("[AudioSettings] Permission request failed:", err);
    }
  };

  const getSourceIcon = (source: AudioSource) => {
    switch (source.type) {
      case "microphone":
        return <Mic className="w-4 h-4" />;
      case "system":
        return <Monitor className="w-4 h-4" />;
      default:
        return <Mic className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    if (error) return "text-red-400";
    if (!isListening) return "text-white/50";
    if (currentSource?.available === false) return "text-yellow-400";
    return "text-green-400";
  };

  const getStatusText = () => {
    if (error) return "Error";
    if (!isListening) return "Stopped";
    if (currentSource?.available === false) return "Unavailable";
    return "Active";
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Audio Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="text-xs text-white/80">Audio Status</span>
        </div>
        <span className={`text-xs ${getStatusColor()}`}>{getStatusText()}</span>
      </div>

      {/* Current Source Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Audio Source</span>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || loading}
            className={`
              flex items-center gap-2 px-2 py-1 rounded text-xs
              ${
                disabled
                  ? "bg-white/10 text-white/50 cursor-not-allowed"
                  : "bg-white/20 hover:bg-white/30 text-white/90 cursor-pointer"
              }
              transition-colors duration-200
            `}
            title={
              currentSource
                ? `Current: ${currentSource.name}`
                : "Select audio source"
            }
          >
            {currentSource ? (
              <>
                {getSourceIcon(currentSource)}
                <span className="truncate max-w-[80px]">
                  {currentSource.name}
                </span>
                {currentSource.available && (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                )}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Select Source</span>
              </>
            )}
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-md shadow-lg">
            <div className="p-2">
              <div className="text-xs text-white/60 mb-2 px-2">
                Available Audio Sources
              </div>

              {loading ? (
                <div className="px-2 py-2 text-xs text-white/50">
                  Loading sources...
                </div>
              ) : sources.length > 0 ? (
                sources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleSourceSelect(source.id)}
                    disabled={!source.available}
                    className={`
                      w-full flex items-center gap-3 px-2 py-2 text-left text-xs rounded transition-colors
                      ${
                        currentSource?.id === source.id
                          ? "bg-white/20 text-white"
                          : source.available
                          ? "hover:bg-white/10 text-white/80"
                          : "text-white/40 cursor-not-allowed"
                      }
                    `}
                  >
                    {getSourceIcon(source)}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{source.name}</div>
                      {!source.available && (
                        <div className="text-xs text-red-400">
                          Permission required
                        </div>
                      )}
                    </div>
                    {currentSource?.id === source.id && (
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-white/50">
                  No sources available
                </div>
              )}

              {/* Permission request button */}
              {sources.some((s) => !s.available) && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <button
                    onClick={requestPermissions}
                    className="w-full px-2 py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded transition-colors"
                  >
                    Request Audio Permissions
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs text-red-400 font-medium">Audio Error</div>
            <div className="text-xs text-red-300 mt-1">{error}</div>
          </div>
        </div>
      )}

      {/* Troubleshooting Help */}
      <div className="space-y-2">
        <button
          onClick={() => setShowTroubleshooting(!showTroubleshooting)}
          className="flex items-center gap-2 text-xs text-white/70 hover:text-white/90 transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          Audio Troubleshooting
          <ChevronDown
            className={`w-3 h-3 transition-transform ${
              showTroubleshooting ? "rotate-180" : ""
            }`}
          />
        </button>

        {showTroubleshooting && (
          <div className="bg-white/5 border border-white/10 rounded p-3 space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Mic className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white/90 mb-1 text-xs">
                    Microphone Issues
                  </div>
                  <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
                    <li>Check if microphone is connected and working</li>
                    <li>Grant microphone permission in system settings</li>
                    <li>Try refreshing and granting permission again</li>
                    <li>Check if another app is using the microphone</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Monitor className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white/90 mb-1 text-xs">
                    System Audio Issues
                  </div>
                  <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
                    <li>
                      Grant screen recording permission in System Preferences
                    </li>
                    <li>
                      macOS: System Preferences → Security & Privacy → Screen
                      Recording
                    </li>
                    <li>
                      Windows: Allow desktop audio capture in app permissions
                    </li>
                    <li>Restart the app after granting permissions</li>
                    <li>Check if audio is playing on your system</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Settings className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white/90 mb-1 text-xs">
                    General Solutions
                  </div>
                  <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
                    <li>Try switching between microphone and system audio</li>
                    <li>Restart the application</li>
                    <li>Check system audio settings and levels</li>
                    <li>Ensure no other apps are blocking audio access</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
