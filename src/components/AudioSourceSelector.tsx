import React, { useState, useEffect } from 'react';
import { Mic, Monitor, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';

interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

interface AudioSourceSelectorProps {
  currentSource?: AudioSource | null;
  onSourceChange: (sourceId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const AudioSourceSelector: React.FC<AudioSourceSelectorProps> = ({
  currentSource,
  onSourceChange,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sources, setSources] = useState<AudioSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemSupported, setSystemSupported] = useState(false);

  // Load available audio sources
  useEffect(() => {
    loadAudioSources();
    checkSystemSupport();
  }, []);

  const loadAudioSources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await window.electronAPI.audioGetSources();
      
      if (result.success) {
        setSources(result.sources);
        console.log('[AudioSourceSelector] Loaded audio sources:', result.sources);
      } else {
        setError(result.error || 'Failed to load audio sources');
        console.error('[AudioSourceSelector] Failed to load sources:', result.error);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error loading audio sources';
      setError(errorMsg);
      console.error('[AudioSourceSelector] Error loading sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemSupport = async () => {
    try {
      const result = await window.electronAPI.audioCheckSystemSupport();
      setSystemSupported(result.supported);
      console.log('[AudioSourceSelector] System audio supported:', result.supported);
    } catch (err) {
      console.warn('[AudioSourceSelector] Failed to check system support:', err);
      setSystemSupported(false);
    }
  };

  const handleSourceSelect = async (sourceId: string) => {
    try {
      setIsOpen(false);
      
      // Don't switch if it's the same source
      if (currentSource?.id === sourceId) {
        return;
      }

      console.log('[AudioSourceSelector] Switching to source:', sourceId);
      onSourceChange(sourceId);
      
    } catch (err) {
      console.error('[AudioSourceSelector] Error switching source:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch audio source');
    }
  };

  const requestPermissions = async () => {
    try {
      setError(null);
      console.log('[AudioSourceSelector] Requesting audio permissions...');
      
      const result = await window.electronAPI.audioRequestPermissions();
      
      if (result.granted) {
        console.log('[AudioSourceSelector] Permissions granted, reloading sources');
        await loadAudioSources();
      } else {
        setError(result.error || 'Audio permissions denied');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to request permissions';
      setError(errorMsg);
      console.error('[AudioSourceSelector] Permission request failed:', err);
    }
  };

  const getSourceIcon = (source: AudioSource) => {
    switch (source.type) {
      case 'microphone':
        return <Mic className="w-4 h-4" />;
      case 'system':
        return <Monitor className="w-4 h-4" />;
      default:
        return <Mic className="w-4 h-4" />;
    }
  };

  const getSourceDisplayName = (source: AudioSource) => {
    if (!source.available) {
      return `${source.name} (Unavailable)`;
    }
    return source.name;
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
        <span className="text-xs text-white/70">Loading audio sources...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-xs text-red-400">Audio error</span>
        <button
          onClick={requestPermissions}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Grant permissions
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Current source display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-xs
          ${disabled 
            ? 'bg-white/10 text-white/50 cursor-not-allowed' 
            : 'bg-white/20 hover:bg-white/30 text-white/90 cursor-pointer'
          }
          transition-colors duration-200
        `}
        title={currentSource ? `Current: ${currentSource.name}` : 'Select audio source'}
      >
        {currentSource ? (
          <>
            {getSourceIcon(currentSource)}
            <span className="truncate max-w-[100px]">
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
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-black/90 backdrop-blur-sm border border-white/20 rounded-md shadow-lg z-50">
          <div className="p-2">
            <div className="text-xs text-white/60 mb-2 px-2">Available Audio Sources</div>
            
            {sources.length === 0 ? (
              <div className="px-2 py-3 text-xs text-white/50">
                No audio sources available
              </div>
            ) : (
              sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => handleSourceSelect(source.id)}
                  disabled={!source.available}
                  className={`
                    w-full flex items-center gap-3 px-2 py-2 rounded text-xs text-left
                    ${currentSource?.id === source.id 
                      ? 'bg-blue-600/50 text-white' 
                      : source.available 
                        ? 'hover:bg-white/10 text-white/80' 
                        : 'text-white/40 cursor-not-allowed'
                    }
                    transition-colors duration-150
                  `}
                >
                  {getSourceIcon(source)}
                  <div className="flex-1">
                    <div className="font-medium">{getSourceDisplayName(source)}</div>
                    <div className="text-xs text-white/50 capitalize">
                      {source.type} input
                      {source.type === 'system' && !systemSupported && ' (Not supported)'}
                    </div>
                  </div>
                  {currentSource?.id === source.id && (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  )}
                  {!source.available && (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                </button>
              ))
            )}

            {/* System audio help text */}
            {sources.some(s => s.type === 'system') && (
              <div className="mt-3 pt-2 border-t border-white/10">
                <div className="text-xs text-white/50 px-2">
                  <div className="flex items-start gap-2">
                    <Monitor className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium mb-1">System Audio</div>
                      <div className="text-white/40">
                        Captures audio from your computer (e.g., Zoom meetings). 
                        Requires screen recording permission.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Permission request button */}
            {sources.some(s => !s.available) && (
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

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};