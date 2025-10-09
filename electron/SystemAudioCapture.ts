import { EventEmitter } from "events";
import { desktopCapturer, DesktopCapturerSource, app } from "electron";
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
  
  // ScreenCaptureKit integration
  private swiftProcess: ChildProcess | null = null;
  private swiftBinaryPath: string;
  private useScreenCaptureKit: boolean = false;

  constructor(config?: Partial<SystemAudioCaptureConfig>) {
    super();
    
    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      bufferSize: 4096,
      ...config
    };

    // Determine path to Swift binary
    const isDev = !app.isPackaged;
    if (isDev) {
      this.swiftBinaryPath = path.join(process.cwd(), 'dist-native', 'SystemAudioCapture');
    } else {
      this.swiftBinaryPath = path.join(process.resourcesPath, 'dist-native', 'SystemAudioCapture');
    }

    // Check if ScreenCaptureKit binary is available
    this.checkScreenCaptureKitAvailability();

    console.log('[SystemAudioCapture] Initialized with config:', this.config);
    console.log('[SystemAudioCapture] Environment:', {
      isDev,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      cwd: process.cwd(),
      platform: process.platform,
      arch: process.arch
    });
    console.log('[SystemAudioCapture] Swift binary path:', this.swiftBinaryPath);
    console.log('[SystemAudioCapture] ScreenCaptureKit available:', this.useScreenCaptureKit);
  }

  /**
   * Check if ScreenCaptureKit binary is available
   */
  private checkScreenCaptureKitAvailability(): void {
    try {
      if (process.platform !== 'darwin') {
        console.log('[SystemAudioCapture] ScreenCaptureKit only available on macOS');
        this.useScreenCaptureKit = false;
        return;
      }

      console.log('[SystemAudioCapture] Checking binary at:', this.swiftBinaryPath);
      
      if (fs.existsSync(this.swiftBinaryPath)) {
        const stats = fs.statSync(this.swiftBinaryPath);
        const isExecutable = (stats.mode & fs.constants.S_IXUSR) !== 0;
        
        console.log('[SystemAudioCapture] Binary found:', {
          size: stats.size,
          mode: stats.mode.toString(8),
          isExecutable,
          isFile: stats.isFile()
        });
        
        if (!isExecutable) {
          console.warn('[SystemAudioCapture] ⚠️  Binary exists but is not executable!');
          console.warn('[SystemAudioCapture] This is likely a packaging issue.');
          console.warn('[SystemAudioCapture] Attempting to set execute permissions...');
          
          try {
            fs.chmodSync(this.swiftBinaryPath, 0o755);
            console.log('[SystemAudioCapture] ✅ Execute permissions set');
          } catch (chmodError) {
            console.error('[SystemAudioCapture] ❌ Failed to set execute permissions:', chmodError);
          }
        }
        
        this.useScreenCaptureKit = true;
      } else {
        console.log('[SystemAudioCapture] ScreenCaptureKit binary not found at expected path');
        console.log('[SystemAudioCapture] Using fallback audio capture method');
        this.useScreenCaptureKit = false;
      }
    } catch (error) {
      console.error('[SystemAudioCapture] Error checking ScreenCaptureKit availability:', error);
      this.useScreenCaptureKit = false;
    }
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

      // Check system audio availability
      let systemAudioAvailable = false;
      let systemAudioName = 'System Audio';

      if (this.useScreenCaptureKit) {
        // Check ScreenCaptureKit availability
        try {
          systemAudioAvailable = await this.checkScreenCaptureKitStatus();
          systemAudioName = systemAudioAvailable ? 'System Audio (ScreenCaptureKit)' : 'System Audio (ScreenCaptureKit - Permission Required)';
          console.log('[SystemAudioCapture] ScreenCaptureKit status check:', systemAudioAvailable);
        } catch (error) {
          console.warn('[SystemAudioCapture] ScreenCaptureKit status check failed:', error);
          systemAudioAvailable = false;
          systemAudioName = 'System Audio (ScreenCaptureKit - Unavailable)';
        }
      } else {
        // Fallback to legacy desktop capture
        try {
          systemAudioAvailable = await SystemAudioCapture.isSystemAudioSupported();
          systemAudioName = systemAudioAvailable ? 'System Audio (Legacy)' : 'System Audio (Legacy - Permission Required)';
          console.log('[SystemAudioCapture] Legacy system audio status:', systemAudioAvailable);
        } catch (error) {
          console.warn('[SystemAudioCapture] Legacy system audio check failed:', error);
          systemAudioAvailable = false;
          systemAudioName = 'System Audio (Legacy - Unavailable)';
        }
      }
      
      sources.push({
        id: 'system-audio',
        name: systemAudioName,
        type: 'system',
        available: systemAudioAvailable
      });

      console.log('[SystemAudioCapture] Available sources:', sources);
      return sources;
      
    } catch (error) {
      console.error('[SystemAudioCapture] Error enumerating sources:', error);
      // Return at least microphone as fallback
      return [{
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      }];
    }
  }

  /**
   * Check ScreenCaptureKit status via Swift binary
   */
  private async checkScreenCaptureKitStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('[SystemAudioCapture] Checking ScreenCaptureKit status...');
        
        // Use command line argument instead of stdin
        const process = spawn(this.swiftBinaryPath, ['status'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasResponded = false;
        
        const timeout = setTimeout(() => {
          if (!hasResponded) {
            console.log('[SystemAudioCapture] ScreenCaptureKit status check timeout');
            process.kill();
            hasResponded = true;
            resolve(false);
          }
        }, 5000); // Reduced timeout

        process.stdout.on('data', (data) => {
          output += data.toString();
          console.log('[SystemAudioCapture] Raw output:', data.toString());
          
          // Look for status data in real-time
          const statusMatch = output.match(/STATUS_DATA: (.+)/);
          if (statusMatch && !hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            try {
              const status = JSON.parse(statusMatch[1]);
              console.log('[SystemAudioCapture] ScreenCaptureKit status:', status);
              resolve(status.isAvailable === true);
            } catch (parseError) {
              console.error('[SystemAudioCapture] Failed to parse status:', parseError);
              resolve(false);
            }
            
            process.kill();
          }
        });

        process.stderr.on('data', (data) => {
          console.warn('[SystemAudioCapture] ScreenCaptureKit stderr:', data.toString());
        });

        process.on('close', (code) => {
          if (!hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            console.log(`[SystemAudioCapture] ScreenCaptureKit process exited with code ${code}`);
            console.log('[SystemAudioCapture] Full output was:', output);
            
            // Even if no STATUS_DATA, try to determine from output
            if (output.includes('ScreenCaptureKit available')) {
              console.log('[SystemAudioCapture] Assuming ScreenCaptureKit available based on output');
              resolve(true);
            } else {
              resolve(false);
            }
          }
        });

        process.on('error', (error) => {
          if (!hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            console.error('[SystemAudioCapture] ScreenCaptureKit process error:', error);
            resolve(false);
          }
        });
        
      } catch (error) {
        console.error('[SystemAudioCapture] ScreenCaptureKit status check failed:', error);
        resolve(false);
      }
    });
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
        if (this.useScreenCaptureKit) {
          await this.startScreenCaptureKitCapture();
        } else {
          await this.startSystemAudioCapture();
        }
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
      
      // Stop ScreenCaptureKit process if running
      if (this.swiftProcess) {
        console.log('[SystemAudioCapture] Stopping ScreenCaptureKit process...');
        this.swiftProcess.stdin?.write('stop\n');
        this.swiftProcess.stdin?.write('quit\n');
        this.swiftProcess.kill();
        this.swiftProcess = null;
      }
      
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
   * Start system audio capture using ScreenCaptureKit
   */
  private async startScreenCaptureKitCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting ScreenCaptureKit system audio capture...');
    
    try {
      // Spawn the Swift binary process
      this.swiftProcess = spawn(this.swiftBinaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle process events
      this.swiftProcess.on('error', (error) => {
        console.error('[SystemAudioCapture] ScreenCaptureKit process error:', error);
        this.emit('error', new Error(`ScreenCaptureKit process failed: ${error.message}`));
      });

      this.swiftProcess.on('exit', (code, signal) => {
        console.log(`[SystemAudioCapture] ScreenCaptureKit process exited with code ${code}, signal ${signal}`);
        if (this.isCapturing && code !== 0) {
          this.emit('error', new Error(`ScreenCaptureKit process exited unexpectedly (code: ${code})`));
        }
      });

      // Handle stdout for audio data and status messages
      this.swiftProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('AUDIO_DATA: ')) {
            try {
              const jsonStr = line.substring('AUDIO_DATA: '.length);
              const audioMessage = JSON.parse(jsonStr);
              
              // Convert base64 audio data back to Buffer
              const audioBuffer = Buffer.from(audioMessage.data, 'base64');
              
              // Emit audio data for processing
              this.emit('audio-data', audioBuffer);
              
            } catch (parseError) {
              console.error('[SystemAudioCapture] Error parsing audio data:', parseError);
            }
          } else if (line.startsWith('STATUS: ')) {
            const status = line.substring('STATUS: '.length);
            console.log(`[SystemAudioCapture] ScreenCaptureKit status: ${status}`);
          } else if (line.startsWith('ERROR: ')) {
            const error = line.substring('ERROR: '.length);
            console.error(`[SystemAudioCapture] ScreenCaptureKit error: ${error}`);
            this.emit('error', new Error(`ScreenCaptureKit: ${error}`));
          } else if (line.startsWith('INFO: ')) {
            const info = line.substring('INFO: '.length);
            console.log(`[SystemAudioCapture] ScreenCaptureKit: ${info}`);
          }
        }
      });

      // Handle stderr
      this.swiftProcess.stderr?.on('data', (data) => {
        console.error('[SystemAudioCapture] ScreenCaptureKit stderr:', data.toString());
      });

      // Start capture
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('ScreenCaptureKit startup timeout'));
        }, 10000);

        // Listen for success indicator
        const onData = (data: Buffer) => {
          const output = data.toString();
          if (output.includes('STATUS: READY')) {
            clearTimeout(timeout);
            this.swiftProcess?.stdout?.off('data', onData);
            resolve();
          } else if (output.includes('ERROR:')) {
            clearTimeout(timeout);
            this.swiftProcess?.stdout?.off('data', onData);
            reject(new Error(output));
          }
        };

        this.swiftProcess?.stdout?.on('data', onData);
        
        // Send start command
        this.swiftProcess?.stdin?.write('start\n');
      });
      
    } catch (error) {
      console.error('[SystemAudioCapture] ScreenCaptureKit capture failed:', error);
      throw new Error(`ScreenCaptureKit capture failed: ${(error as Error).message}`);
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
   * Request ScreenCaptureKit permissions via Swift binary
   */
  private async requestScreenCaptureKitPermissions(): Promise<{ granted: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        console.log('[SystemAudioCapture] Requesting ScreenCaptureKit permissions...');
        
        // Use command line argument instead of stdin
        const process = spawn(this.swiftBinaryPath, ['permissions'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let hasResponded = false;
        
        // Longer timeout for permission dialogs
        const timeout = setTimeout(() => {
          if (!hasResponded) {
            console.log('[SystemAudioCapture] ScreenCaptureKit permission request timeout');
            process.kill();
            hasResponded = true;
            resolve({ 
              granted: false, 
              error: 'Permission request timed out. Please check System Preferences.' 
            });
          }
        }, 15000); // 15 seconds for user interaction

        process.stdout.on('data', (data) => {
          output += data.toString();
          
          // Look for permission result
          const permissionMatch = output.match(/PERMISSION_RESULT: (.+)/);
          if (permissionMatch && !hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            try {
              const result = JSON.parse(permissionMatch[1]);
              console.log('[SystemAudioCapture] ScreenCaptureKit permission result:', result);
              
              resolve({ 
                granted: result.granted === true,
                error: result.granted ? undefined : (result.message || result.error || 'Permission denied')
              });
            } catch (parseError) {
              console.error('[SystemAudioCapture] Failed to parse permission result:', parseError);
              resolve({ granted: false, error: 'Failed to parse permission response' });
            }
            
            process.kill();
          }
        });

        process.stderr.on('data', (data) => {
          console.warn('[SystemAudioCapture] ScreenCaptureKit permission stderr:', data.toString());
        });

        process.on('close', (code) => {
          if (!hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            console.log(`[SystemAudioCapture] Permission process exited with code ${code}`);
            resolve({ 
              granted: false, 
              error: `Permission process exited unexpectedly (code: ${code})` 
            });
          }
        });

        process.on('error', (error) => {
          if (!hasResponded) {
            clearTimeout(timeout);
            hasResponded = true;
            
            console.error('[SystemAudioCapture] Permission process error:', error);
            resolve({ 
              granted: false, 
              error: `Permission process failed: ${error.message}` 
            });
          }
        });

        // Command line argument used, no need to send to stdin
        // process.stdin.write('permissions\n');
        
        // End stdin after a short delay
        // setTimeout(() => {
        //   if (process && !process.killed) {
        //     process.stdin.end();
        //   }
        // }, 1000);
        
      } catch (error) {
        console.error('[SystemAudioCapture] Permission request failed:', error);
        resolve({ 
          granted: false, 
          error: `Permission request failed: ${(error as Error).message}` 
        });
      }
    });
  }

  /**
   * Request necessary permissions for system audio capture
   */
  public async requestPermissions(): Promise<{ granted: boolean; error?: string }> {
    try {
      console.log('[SystemAudioCapture] Requesting permissions...');
      
      // Note: Microphone permission testing is handled in the renderer process
      // Here we handle system audio permissions
      
      if (this.useScreenCaptureKit) {
        // Use ScreenCaptureKit permission request
        console.log('[SystemAudioCapture] Using ScreenCaptureKit permission request');
        return await this.requestScreenCaptureKitPermissions();
      } else {
        // Fallback to legacy desktop capture permission check
        console.log('[SystemAudioCapture] Using legacy desktop capture permission check');
        try {
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            fetchWindowIcons: false
          });
          
          if (sources.length > 0) {
            console.log('[SystemAudioCapture] Legacy system audio permission available');
            return { granted: true };
          } else {
            return { 
              granted: false, 
              error: 'No desktop sources available. Screen recording permission may be required in System Preferences → Security & Privacy → Screen Recording.' 
            };
          }
        } catch (sysError) {
          console.error('[SystemAudioCapture] Legacy system audio permission failed:', sysError);
          return { 
            granted: false, 
            error: `System audio permission denied. Please grant Screen Recording permission in System Preferences → Security & Privacy → Screen Recording, then restart the app.` 
          };
        }
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