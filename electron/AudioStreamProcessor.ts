import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { SystemAudioCapture, AudioSource } from "./SystemAudioCapture";
import { AudioTranscriber } from "./audio/AudioTranscriber";
import { QuestionRefiner } from "./audio/QuestionRefiner";
import { StreamingQuestionDetector } from "./audio/StreamingQuestionDetector";
import {
  AudioChunk,
  AudioStreamState,
  AudioStreamConfig,
  AudioStreamEvents,
  TranscriptionResult,
  DetectedQuestion
} from "../src/types/audio-stream";

export class AudioStreamProcessor extends EventEmitter {
  private state: AudioStreamState;
  private config: AudioStreamConfig;
  private systemAudioCapture: SystemAudioCapture;
  private audioTranscriber: AudioTranscriber;
  private questionRefiner: QuestionRefiner;
  private streamingDetector: StreamingQuestionDetector;
  
  // Audio processing
  private currentAudioData: Float32Array[] = [];
  private lastSilenceTime: number = 0;
  private wordCount: number = 0;
  private tempBuffer: Float32Array | null = null;
  private lastChunkTime: number = 0;
  private accumulatedSamples: number = 0;

  constructor(openaiApiKey: string, config?: Partial<AudioStreamConfig>) {
    super();
    
    // Validate OpenAI API key
    if (!openaiApiKey || openaiApiKey.trim() === '') {
      throw new Error('OpenAI API key is required for AudioStreamProcessor');
    }
    
    // Initialize modules
    this.audioTranscriber = new AudioTranscriber(openaiApiKey, config?.sampleRate || 16000);
    this.questionRefiner = new QuestionRefiner();
    this.streamingDetector = new StreamingQuestionDetector();
    
    // Simplified configuration - removed batching
    this.config = {
      sampleRate: 16000,
      chunkDuration: 1000,
      silenceThreshold: 800,
      maxWords: 40,
      questionDetectionEnabled: true,
      batchInterval: 0, // Not used anymore
      maxBatchSize: 0, // Not used anymore
      ...config
    };

    // Simplified state - removed batch processor
    this.state = {
      isListening: false,
      isProcessing: false,
      lastActivityTime: 0,
      questionBuffer: [],
      batchProcessor: {
        lastBatchTime: 0,
        isProcessing: false,
        pendingQuestions: []
      },
      currentAudioSource: null
    };

    // Initialize SystemAudioCapture
    this.systemAudioCapture = new SystemAudioCapture({
      sampleRate: this.config.sampleRate,
      channelCount: 1,
      bufferSize: 4096
    });

    // Setup system audio capture event listeners
    this.setupSystemAudioEvents();
  }

  /**
   * Start always-on audio listening with specified audio source
   */
  public async startListening(audioSourceId?: string): Promise<void> {
    if (this.state.isListening) return;

    try {
      // If audio source is specified and it's system audio, start system capture
      if (audioSourceId && audioSourceId !== 'microphone') {
        try {
          await this.systemAudioCapture.startCapture(audioSourceId);
          const captureState = this.systemAudioCapture.getState();
          this.state.currentAudioSource = captureState.currentSource;
          
        } catch (systemError) {
          // Enhanced fallback strategy
          let fallbackSucceeded = false;
          const fallbackAttempts = [
            {
              id: 'microphone',
              name: 'Microphone (Auto-Fallback)',
              description: 'System audio unavailable, using microphone'
            }
          ];
          
          for (const fallback of fallbackAttempts) {
            try {
              this.state.currentAudioSource = {
                id: fallback.id,
                name: fallback.name,
                type: 'microphone',
                available: true
              };
              
              fallbackSucceeded = true;
              break;
            } catch (fallbackError) {
              // Silent fallback failure
            }
          }
          
          if (fallbackSucceeded) {
            const errorMessage = this.getSystemAudioErrorMessage(systemError as Error);
            this.emit('error', new Error(errorMessage));
          } else {
            throw new Error('All audio capture methods failed. Please check your audio permissions.');
          }
        }
      } else {
        // Default to microphone (existing behavior)
        this.state.currentAudioSource = {
          id: 'microphone',
          name: 'Microphone',
          type: 'microphone',
          available: true
        };
      }

      this.state.isListening = true;
      this.state.lastActivityTime = Date.now();
      this.emit('state-changed', { ...this.state });
      
    } catch (error) {
      this.state.isListening = false;
      this.state.currentAudioSource = null;
      console.error('[AudioStreamProcessor] Failed to start listening:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop audio listening
   */
  public async stopListening(): Promise<void> {
    if (!this.state.isListening) return;

    try {
      // Stop system audio capture if active
      if (this.state.currentAudioSource?.type === 'system') {
        await this.systemAudioCapture.stopCapture();
      }

      this.state.isListening = false;
      this.state.isProcessing = false;
      this.state.currentAudioSource = null;
      
      // Clear any pending audio data
      this.currentAudioData = [];
      this.wordCount = 0;
      
      // Clear the question buffer to ensure fresh start for next recording session
      this.clearQuestions();
      
      this.emit('state-changed', { ...this.state });
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error stopping listening:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Process audio data chunk received from renderer
   */
  public async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.state.isListening) return;

    try {
      // Convert Buffer to Float32Array
      const float32Array = new Float32Array(audioData.length / 2);
      for (let i = 0; i < float32Array.length; i++) {
        const sample = audioData.readInt16LE(i * 2);
        float32Array[i] = sample / 32768.0;
      }
      
      // Add to current audio accumulation
      this.currentAudioData.push(float32Array);
      this.accumulatedSamples += float32Array.length;
      this.state.lastActivityTime = Date.now();
      
      // Initialize last chunk time if not set
      if (this.lastChunkTime === 0) {
        this.lastChunkTime = Date.now();
      }
      
      // Check if we should create a chunk based on duration or word count
      if (await this.shouldCreateChunk()) {
        await this.createAndProcessChunk();
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error processing audio chunk:', error);
      this.emit('error', error as Error);
      this.state.isListening = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Determine if we should create a new chunk - ULTRA OPTIMIZED for speed
   */
  private async shouldCreateChunk(): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastChunk = now - this.lastChunkTime;
    const accumulatedDuration = (this.accumulatedSamples / this.config.sampleRate) * 1000;
    
    // OPTIMIZED: Create chunk if:
    // 1. We have accumulated 800ms+ of audio OR
    // 2. We haven't created a chunk in 1.5+ seconds OR  
    // 3. Word count exceeds limit OR
    // 4. We detect potential question markers in recent audio
    const shouldCreateByDuration = accumulatedDuration >= 800;
    const shouldCreateByTime = timeSinceLastChunk >= 1500;
    const shouldCreateByWords = this.wordCount >= this.config.maxWords;
    const shouldCreateByQuestionHint = this.streamingDetector.hasRecentQuestionActivity();
    
    return shouldCreateByDuration || shouldCreateByTime || shouldCreateByWords || shouldCreateByQuestionHint;
  }

  /**
   * Create chunk from accumulated audio data and process it
   */
  private async createAndProcessChunk(): Promise<void> {
    if (this.currentAudioData.length === 0) return;

    try {
      // Combine all Float32Arrays
      const totalLength = this.currentAudioData.reduce((acc, arr) => acc + arr.length, 0);
      const combinedArray = new Float32Array(totalLength);
      let offset = 0;
      
      for (const array of this.currentAudioData) {
        combinedArray.set(array, offset);
        offset += array.length;
      }
      
      const chunk: AudioChunk = {
        id: uuidv4(),
        data: combinedArray,
        timestamp: Date.now(),
        duration: this.calculateDuration(combinedArray.length),
        wordCount: this.wordCount
      };

      // Reset accumulation
      this.currentAudioData = [];
      this.wordCount = 0;
      this.accumulatedSamples = 0;
      this.lastChunkTime = Date.now();
      
      this.emit('chunk-recorded', chunk);
      
      // Process chunk for transcription
      await this.transcribeChunk(chunk);
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error creating chunk:', error);
      this.emit('error', error as Error);
      this.state.isListening = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Transcribe audio chunk using OpenAI Whisper
   */
  private async transcribeChunk(chunk: AudioChunk): Promise<void> {
    if (!this.config.questionDetectionEnabled) return;

    try {
      this.state.isProcessing = true;
      this.emit('state-changed', { ...this.state });

      // Use AudioTranscriber module
      const result = await this.audioTranscriber.transcribe(chunk);

      this.emit('transcription-completed', result);

      // Update streaming detector
      this.streamingDetector.updateRecentAudioBuffer(result.text);

      // Check for streaming question detection
      const hasStreamingQuestion = this.streamingDetector.checkForStreamingQuestion(result.text);
      if (hasStreamingQuestion && this.currentAudioData.length > 0) {
        this.createAndProcessChunk().catch(error => {
          console.error('[AudioStreamProcessor] Error in streaming-triggered chunk processing:', error);
        });
      }

      // Detect and immediately refine questions
      if (result.text.trim()) {
        await this.detectAndRefineQuestions(result);
      }

    } catch (error) {
      console.error('[AudioStreamProcessor] Transcription error:', error);
      this.emit('error', error as Error);
    } finally {
      this.state.isProcessing = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Detect questions and immediately refine them algorithmically
   */
  private async detectAndRefineQuestions(transcription: TranscriptionResult): Promise<void> {
    try {
      // Use QuestionRefiner module
      const refinedQuestions = await this.questionRefiner.detectAndRefineQuestions(transcription);
      
      // Add valid questions to state and emit immediately
      for (const question of refinedQuestions) {
        this.state.questionBuffer.push(question);
        this.emit('question-detected', question);
      }

      // Emit state change if we added any questions
      if (refinedQuestions.length > 0) {
        this.emit('state-changed', { ...this.state });
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Question detection error:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Get current state
   */
  public getState(): AudioStreamState {
    return { ...this.state };
  }

  /**
   * Get all detected questions
   */
  public getQuestions(): DetectedQuestion[] {
    return [...this.state.questionBuffer];
  }

  /**
   * Clear question buffer
   */
  public clearQuestions(): void {
    this.state.questionBuffer = [];
    this.streamingDetector.clear();
    this.emit('state-changed', { ...this.state });
  }

  /**
   * Helper methods for audio processing
   */
  private calculateDuration(sampleCount: number): number {
    return (sampleCount / this.config.sampleRate) * 1000;
  }

  /**
   * Get available audio sources
   */
  public async getAvailableAudioSources(): Promise<AudioSource[]> {
    try {
      return await this.systemAudioCapture.getAvailableSources();
    } catch (error) {
      console.error('[AudioStreamProcessor] Error getting audio sources:', error);
      // Return fallback microphone source
      return [{
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      }];
    }
  }

  /**
   * Switch to a different audio source
   */
  public async switchAudioSource(sourceId: string): Promise<void> {
    const wasListening = this.state.isListening;
    const previousSource = this.state.currentAudioSource;
    
    try {
      // Stop current listening if active
      if (wasListening) {
        await this.stopListening();
      }
      
      // Start with new source if we were previously listening
      if (wasListening) {
        try {
          await this.startListening(sourceId);
        } catch (switchError) {
          // Try to restore previous source
          if (previousSource && previousSource.id !== sourceId) {
            try {
              await this.startListening(previousSource.id);
              this.emit('error', new Error(`Failed to switch to ${sourceId}, restored ${previousSource.name}: ${(switchError as Error).message}`));
            } catch (restoreError) {
              // Final fallback to microphone
              try {
                await this.startListening('microphone');
                this.emit('error', new Error(`Audio source switch failed, using microphone fallback: ${(switchError as Error).message}`));
              } catch (micError) {
                throw new Error(`All audio sources failed: ${(micError as Error).message}`);
              }
            }
          } else {
            throw switchError;
          }
        }
      } else {
        // Just update the current source without starting capture
        const sources = await this.getAvailableAudioSources();
        const targetSource = sources.find(s => s.id === sourceId);
        
        if (targetSource && targetSource.available) {
          this.state.currentAudioSource = targetSource;
          this.emit('state-changed', { ...this.state });
        } else {
          throw new Error(`Audio source not available: ${sourceId}`);
        }
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Failed to switch audio source:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Request permissions for audio capture
   */
  public async requestAudioPermissions(): Promise<{ granted: boolean; error?: string }> {
    try {
      return await this.systemAudioCapture.requestPermissions();
    } catch (error) {
      console.error('[AudioStreamProcessor] Permission request failed:', error);
      return { 
        granted: false, 
        error: `Permission request failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Get user-friendly error message for system audio failures
   */
  private getSystemAudioErrorMessage(error: Error): string {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('screencapturekit') && errorMsg.includes('permission')) {
      return 'System audio restored to microphone. For better Zoom compatibility, grant Screen Recording permission in System Preferences → Security & Privacy → Screen Recording, then restart the app.';
    } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
      return 'System audio restored to microphone. Screen recording permission required for system audio capture.';
    } else if (errorMsg.includes('macos') || errorMsg.includes('version')) {
      return 'System audio restored to microphone. macOS 13.0+ required for enhanced system audio capture.';
    } else if (errorMsg.includes('binary') || errorMsg.includes('not found')) {
      return 'System audio restored to microphone. Enhanced system audio components not available.';
    } else {
      return `System audio restored to microphone. ${error.message}`;
    }
  }
  private setupSystemAudioEvents(): void {
    this.systemAudioCapture.on('audio-data', (audioData: Buffer) => {
      // Forward system audio data to existing processing pipeline
      if (this.state.isListening && this.state.currentAudioSource?.type === 'system') {
        this.processAudioChunk(audioData).catch(error => {
          console.error('[AudioStreamProcessor] Error processing system audio chunk:', error);
        });
      }
    });

    this.systemAudioCapture.on('source-changed', (source: AudioSource) => {
      this.state.currentAudioSource = source;
      this.emit('state-changed', { ...this.state });
    });

    this.systemAudioCapture.on('error', (error: Error) => {
      console.error('[AudioStreamProcessor] System audio capture error:', error);
      this.emit('error', error);
    });

    this.systemAudioCapture.on('state-changed', (captureState) => {
      // Update our state based on system audio capture state
      if (!captureState.isCapturing && this.state.currentAudioSource?.type === 'system') {
        this.state.currentAudioSource = null;
        this.emit('state-changed', { ...this.state });
      }
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.removeAllListeners();
    this.currentAudioData = [];
    this.state.questionBuffer = [];
    
    // Cleanup system audio capture
    if (this.systemAudioCapture) {
      this.systemAudioCapture.destroy();
    }
  }
}