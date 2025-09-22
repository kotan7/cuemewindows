import React, { useState } from 'react';
import { HelpCircle, X, Monitor, Mic, Settings, Shield, AlertCircle } from 'lucide-react';

interface AudioTroubleshootingHelpProps {
  error?: string | null;
  currentSource?: { type: 'microphone' | 'system' } | null;
  onClose?: () => void;
  className?: string;
}

export const AudioTroubleshootingHelp: React.FC<AudioTroubleshootingHelpProps> = ({
  error,
  currentSource,
  onClose,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getMicrophoneTroubleshooting = () => (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Mic className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-white/90 mb-1">Microphone Issues</div>
          <ul className="text-xs text-white/70 space-y-1">
            <li>• Check if microphone is connected and working</li>
            <li>• Grant microphone permission in browser/system settings</li>
            <li>• Try refreshing the page and granting permission again</li>
            <li>• Check if another app is using the microphone</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const getSystemAudioTroubleshooting = () => (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Monitor className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-white/90 mb-1">System Audio Issues</div>
          <ul className="text-xs text-white/70 space-y-1">
            <li>• Grant screen recording permission in System Preferences</li>
            <li>• macOS: System Preferences → Security & Privacy → Screen Recording</li>
            <li>• Windows: Allow desktop audio capture in app permissions</li>
            <li>• Restart the app after granting permissions</li>
            <li>• Check if audio is playing on your system</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const getGeneralTroubleshooting = () => (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Settings className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-white/90 mb-1">General Solutions</div>
          <ul className="text-xs text-white/70 space-y-1">
            <li>• Try switching between microphone and system audio</li>
            <li>• Restart the application</li>
            <li>• Check system audio settings and levels</li>
            <li>• Ensure no other apps are blocking audio access</li>
            <li>• Try using a different audio source</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const getPermissionHelp = () => (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Shield className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium text-white/90 mb-1">Permission Setup</div>
          <div className="text-xs text-white/70 space-y-2">
            <div>
              <div className="font-medium text-white/80">macOS:</div>
              <ul className="ml-2 space-y-1">
                <li>• System Preferences → Security & Privacy → Microphone</li>
                <li>• System Preferences → Security & Privacy → Screen Recording</li>
                <li>• Add and enable this app in both sections</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-white/80">Windows:</div>
              <ul className="ml-2 space-y-1">
                <li>• Settings → Privacy → Microphone → Allow apps to access</li>
                <li>• Settings → Privacy → Camera → Allow desktop apps</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const getErrorSpecificHelp = () => {
    if (!error) return null;

    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('permission') || errorLower.includes('denied')) {
      return getPermissionHelp();
    }
    
    if (errorLower.includes('microphone') || errorLower.includes('mic')) {
      return getMicrophoneTroubleshooting();
    }
    
    if (errorLower.includes('system') || errorLower.includes('desktop') || errorLower.includes('screen')) {
      return getSystemAudioTroubleshooting();
    }
    
    return getGeneralTroubleshooting();
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-white/5 rounded transition-colors ${className}`}
        title="Get help with audio issues"
      >
        <HelpCircle className="w-3 h-3" />
        Help
      </button>
    );
  }

  return (
    <div className={`bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-white/90">Audio Troubleshooting</span>
        </div>
        <button
          onClick={() => {
            setIsExpanded(false);
            onClose?.();
          }}
          className="text-white/50 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
            <div className="text-xs text-red-400 font-medium mb-1">Current Error:</div>
            <div className="text-xs text-red-300">{error}</div>
          </div>
        )}

        {getErrorSpecificHelp() || (
          <div className="space-y-4">
            {currentSource?.type === 'system' ? getSystemAudioTroubleshooting() : getMicrophoneTroubleshooting()}
            {getGeneralTroubleshooting()}
          </div>
        )}

        <div className="pt-2 border-t border-white/10">
          <div className="text-xs text-white/50">
            Still having issues? Try switching to a different audio source or restarting the application.
          </div>
        </div>
      </div>
    </div>
  );
};