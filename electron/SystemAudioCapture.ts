import { EventEmitter } from "events";
import { desktopCapturer, DesktopCapturerSource } from "electron";

export interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

export interface SystemAudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

export interface SystemAudioCaptureEvents {
  'audio-data': (audioData: Buffer) => void;
  'source-changed': (source: AudioSource) => void;
  'error': (error: Error) => void;
  'state-changed': (state: { isCapturing: boolean; currentSource?: AudioSource }) => void;
}

export class SystemAudioCapture extends EventEmitter {
  private isCapturing: boolean = false;
  private currentSource: AudioSource | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private config: SystemAudioCaptureConfig;

  constructor(config?: Partial<SystemAudioCaptureConfig>) {
    super();
    
    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      bufferSize: 4096,
      ...config
    };

    console.log('[SystemAudioCapture] Initialized with config:', this.config);
  }

  /**
   * Get available audio sources including system audio and microphone
   */
  public async getAvailableSources(): Promise<AudioSource[]> {
    try {
      console.log('[SystemAudioCapture] Enumerating available audio sources...');
      
      const sources: AudioSource[] = [];
      
      // Add microphone as a source (always available)
      sources.push({
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      });

      // Get system audio sources using desktopCapturer
      try {
        const desktopSources = await desktopCapturer.getSources({
          types: ['screen'],
          fetchWindowIcons: false
        });

        console.log('[SystemAudioCapture] Found desktop sources:', desktopSources.length);

        // Check if any source supports audio capture
        if (desktopSources.length > 0) {
          sources.push({
            id: 'system-audio',
            name: 'System Audio',
            type: 'system',
            available: true
          });
          console.log('[SystemAudioCapture] System audio capture available');
        } else {
          console.log('[SystemAudioCapture] No desktop sources found, system audio unavailable');
        }
      } catch (desktopError) {
        console.warn('[SystemAudioCapture] Desktop capturer failed:', desktopError);
        
        // Add system audio as unavailable
        sources.push({
          id: 'system-audio',
          name: 'System Audio (Unavailable)',
          type: 'system',
          available: false
        });
      }

      console.log('[SystemAudioCapture] Available sources:', sources);
      return sources;
    } catch (error) {
      console.error('[SystemAudioCapture] Error enumerating sources:', error);
      this.emit('error', error as Error);
      
      // Return minimal fallback sources
      return [{
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      }];
    }
  }

  /**
   * Start capturing audio from the specified source
   */
  public async startCapture(sourceId: string): Promise<void> {
    if (this.isCapturing) {
      console.log('[SystemAudioCapture] Already capturing, stopping current capture first');
      await this.stopCapture();
    }

    try {
      console.log('[SystemAudioCapture] Starting capture from source:', sourceId);
      
      const sources = await this.getAvailableSources();
      const targetSource = sources.find(s => s.id === sourceId);
      
      if (!targetSource) {
        throw new Error(`Audio source not found: ${sourceId}`);
      }
      
      if (!targetSource.available) {
        throw new Error(`Audio source not available: ${targetSource.name}`);
      }

      this.currentSource = targetSource;
      
      if (sourceId === 'microphone') {
        await this.startMicrophoneCapture();
      } else if (sourceId === 'system-audio') {
        await this.startSystemAudioCapture();
      } else {
        throw new Error(`Unsupported audio source: ${sourceId}`);
      }

      this.isCapturing = true;
      this.emit('source-changed', targetSource);
      this.emit('state-changed', { isCapturing: true, currentSource: targetSource });
      
      console.log('[SystemAudioCapture] Successfully started capture from:', targetSource.name);
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to start capture:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  public async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      console.log('[SystemAudioCapture] Not currently capturing');
      return;
    }

    try {
      console.log('[SystemAudioCapture] Stopping audio capture...');
      
      // Clean up audio processing
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
          console.log('[SystemAudioCapture] Stopped track:', track.kind, track.label);
        });
        this.mediaStream = null;
      }

      this.isCapturing = false;
      const previousSource = this.currentSource;
      this.currentSource = null;
      
      this.emit('state-changed', { isCapturing: false });
      console.log('[SystemAudioCapture] Successfully stopped capture');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Error stopping capture:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Switch to a different audio source
   */
  public async switchSource(sourceId: string): Promise<void> {
    console.log('[SystemAudioCapture] Switching to source:', sourceId);
    
    const wasCapturing = this.isCapturing;
    
    if (wasCapturing) {
      await this.stopCapture();
    }
    
    if (wasCapturing) {
      await this.startCapture(sourceId);
    }
  }

  /**
   * Get current capture state
   */
  public getState(): { isCapturing: boolean; currentSource: AudioSource | null } {
    return {
      isCapturing: this.isCapturing,
      currentSource: this.currentSource
    };
  }

  /**
   * Start microphone capture using getUserMedia
   */
  private async startMicrophoneCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting microphone capture...');
    
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: this.config.sampleRate },
          channelCount: { ideal: this.config.channelCount },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      await this.setupAudioProcessing();
      console.log('[SystemAudioCapture] Microphone capture started successfully');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Microphone capture failed:', error);
      throw new Error(`Microphone access failed: ${(error as Error).message}`);
    }
  }

  /**
   * Start system audio capture using desktopCapturer
   */
  private async startSystemAudioCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting system audio capture...');
    
    try {
      // Get desktop sources with audio
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false
      });

      if (sources.length === 0) {
        throw new Error('No desktop sources available. Screen recording permission may be required.');
      }

      // Use the first available source (typically the entire screen)
      const source = sources[0];
      console.log('[SystemAudioCapture] Using desktop source:', source.name);

      // Create media stream from desktop capturer with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
              }
            } as any,
            video: false
          } as any);
          
          break; // Success, exit retry loop
          
        } catch (streamError) {
          retryCount++;
          console.warn(`[SystemAudioCapture] Stream creation attempt ${retryCount} failed:`, streamError);
          
          if (retryCount >= maxRetries) {
            // Check for specific error types and provide helpful messages
            const errorMsg = (streamError as Error).message.toLowerCase();
            if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
              throw new Error('Screen recording permission denied. Please grant permission in System Preferences → Security & Privacy → Screen Recording.');
            } else if (errorMsg.includes('not found') || errorMsg.includes('invalid')) {
              throw new Error('Desktop audio source not available. Try restarting the application.');
            } else {
              throw new Error(`System audio access failed: ${(streamError as Error).message}`);
            }
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      await this.setupAudioProcessing();
      console.log('[SystemAudioCapture] System audio capture started successfully');
      
    } catch (error) {
      console.error('[SystemAudioCapture] System audio capture failed:', error);
      
      // Provide more specific error messages
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
        throw new Error('Screen recording permission required for system audio capture. Please check System Preferences.');
      } else if (errorMsg.includes('not available') || errorMsg.includes('not found')) {
        throw new Error('System audio capture not available on this device or platform.');
      } else {
        throw new Error(`System audio capture failed: ${errorMsg}`);
      }
    }
  }

  /**
   * Setup audio processing pipeline for the current media stream
   */
  private async setupAudioProcessing(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('No media stream available for audio processing');
    }

    console.log('[SystemAudioCapture] Setting up audio processing...');
    
    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create media stream source
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create script processor for audio data extraction
      this.processor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Setup audio processing callback
      this.processor.onaudioprocess = (event) => {
        try {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Check for actual audio data
          const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
          
          if (hasAudio) {
            // Convert Float32Array to Buffer for compatibility with existing AudioStreamProcessor
            const buffer = Buffer.alloc(inputData.length * 2);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              buffer.writeInt16LE(sample, i * 2);
            }
            
            this.emit('audio-data', buffer);
          }
        } catch (error) {
          console.error('[SystemAudioCapture] Audio processing error:', error);
          this.emit('error', error as Error);
        }
      };

      // Connect the audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('[SystemAudioCapture] Audio processing pipeline established');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to setup audio processing:', error);
      throw error;
    }
  }

  /**
   * Check if system audio capture is supported on current platform
   */
  public static async isSystemAudioSupported(): Promise<boolean> {
    try {
      // Test if desktopCapturer is available and functional
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false
      });
      
      return sources.length > 0;
    } catch (error) {
      console.warn('[SystemAudioCapture] System audio support check failed:', error);
      return false;
    }
  }

  /**
   * Request necessary permissions for system audio capture
   */
  public async requestPermissions(): Promise<{ granted: boolean; error?: string }> {
    try {
      console.log('[SystemAudioCapture] Requesting permissions...');
      
      // Test microphone permission
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(track => track.stop());
        console.log('[SystemAudioCapture] Microphone permission granted');
      } catch (micError) {
        console.warn('[SystemAudioCapture] Microphone permission denied:', micError);
      }

      // Test system audio permission (this will trigger system permission dialog)
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          fetchWindowIcons: false
        });
        
        if (sources.length > 0) {
          console.log('[SystemAudioCapture] System audio permission available');
          return { granted: true };
        } else {
          return { 
            granted: false, 
            error: 'No desktop sources available. Screen recording permission may be required.' 
          };
        }
      } catch (sysError) {
        console.error('[SystemAudioCapture] System audio permission failed:', sysError);
        return { 
          granted: false, 
          error: `System audio permission denied: ${(sysError as Error).message}` 
        };
      }
      
    } catch (error) {
      console.error('[SystemAudioCapture] Permission request failed:', error);
      return { 
        granted: false, 
        error: `Permission request failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    console.log('[SystemAudioCapture] Destroying instance...');
    
    this.stopCapture().catch(error => {
      console.error('[SystemAudioCapture] Error during cleanup:', error);
    });
    
    this.removeAllListeners();
  }
}