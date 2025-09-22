import React, { useState, useEffect } from 'react';
import { Mic, Monitor, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { AudioSource } from '../types/audio-stream';

interface AudioLevelIndicatorProps {
  isListening: boolean;
  currentSource?: AudioSource | null;
  audioLevel?: number; // 0-1 range
  error?: string | null;
  className?: string;
}

export const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({
  isListening,
  currentSource,
  audioLevel = 0,
  error,
  className = ''
}) => {
  const [animationLevel, setAnimationLevel] = useState(0);

  // Smooth animation for audio level
  useEffect(() => {
    if (isListening && audioLevel > 0) {
      setAnimationLevel(audioLevel);
    } else {
      setAnimationLevel(0);
    }
  }, [isListening, audioLevel]);

  const getSourceIcon = () => {
    if (!currentSource) return <Mic className="w-3 h-3" />;
    
    switch (currentSource.type) {
      case 'microphone':
        return <Mic className="w-3 h-3" />;
      case 'system':
        return <Monitor className="w-3 h-3" />;
      default:
        return <Mic className="w-3 h-3" />;
    }
  };

  const getStatusColor = () => {
    if (error) return 'text-red-400';
    if (!isListening) return 'text-white/50';
    if (currentSource?.available === false) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (!isListening) return 'Stopped';
    if (currentSource?.available === false) return 'Unavailable';
    return 'Active';
  };

  const renderAudioBars = () => {
    const bars = [];
    const barCount = 5;
    
    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.max(2, (animationLevel * 12) * (i + 1) / barCount);
      const isActive = isListening && (animationLevel * barCount) > i;
      
      bars.push(
        <div
          key={i}
          className={`w-1 bg-current transition-all duration-150 ${
            isActive ? 'opacity-100' : 'opacity-30'
          }`}
          style={{ 
            height: `${barHeight}px`,
            minHeight: '2px'
          }}
        />
      );
    }
    
    return bars;
  };

  if (error) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span className="text-xs text-red-400" title={error}>
          Audio Error
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Source Icon with Status */}
      <div className={`flex items-center gap-1 ${getStatusColor()}`}>
        {getSourceIcon()}
        {isListening ? (
          <Wifi className="w-2 h-2" />
        ) : (
          <WifiOff className="w-2 h-2" />
        )}
      </div>

      {/* Audio Level Bars */}
      <div className={`flex items-end gap-0.5 h-3 ${getStatusColor()}`}>
        {renderAudioBars()}
      </div>

      {/* Status Text */}
      <span className={`text-xs ${getStatusColor()}`}>
        {getStatusText()}
      </span>

      {/* Source Name */}
      {currentSource && (
        <span className="text-xs text-white/60" title={currentSource.name}>
          ({currentSource.type === 'system' ? 'System' : 'Mic'})
        </span>
      )}
    </div>
  );
};