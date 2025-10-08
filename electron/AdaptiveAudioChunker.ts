import { EventEmitter } from "events";
import { AudioChunk } from "../src/types/audio-stream";
import { measureTime, measureMemory } from "./decorators/PerformanceDecorators";

export interface ChunkingConfig {
  sampleRate: number;
  minChunkDuration: number;    // Minimum chunk duration in ms
  maxChunkDuration: number;    // Maximum chunk duration in ms
  silenceThreshold: number;    // RMS threshold for silence detection
  silenceDuration: number;     // Duration of silence to trigger immediate processing
  contentAnalysisWindow: number; // Window size for content analysis
  adaptiveThreshold: number;   // Threshold for adaptive adjustments
}

export interface ContentAnalysis {
  rmsLevel: number;
  silenceDuration: number;
  speechDensity: number;
  energyVariance: number;
  hasQuestionMarkers: boolean;
}

export interface ChunkingDecision {
  shouldChunk: boolean;
  reason: 'silence' | 'duration' | 'content' | 'maxSize';
  confidence: number;
  suggestedDelay: number; // Additional delay before next chunk evaluation
}

/**
 * Adaptive Audio Chunker - Implements content-aware chunking with silence detection
 * and dynamic chunk size adjustment based on audio content analysis.
 */
export class AdaptiveAudioChunker extends EventEmitter {
  private config: ChunkingConfig;
  private audioBuffer: Float32Array[] = [];
  private lastChunkTime: number = 0;
  private silenceStartTime: number = 0;
  private isInSilence: boolean = false;
  private contentHistory: ContentAnalysis[] = [];
  private adaptiveMultiplier: number = 1.0;

  constructor(config: Partial<ChunkingConfig> = {}) {
    super();
    
    this.config = {
      sampleRate: 16000,
      minChunkDuration: 500,     // 0.5 seconds minimum
      maxChunkDuration: 5000,    // 5 seconds maximum
      silenceThreshold: 0.01,    // RMS threshold for silence
      silenceDuration: 800,      // 800ms of silence triggers processing
      contentAnalysisWindow: 1000, // 1 second analysis window
      adaptiveThreshold: 0.7,    // Confidence threshold for adaptive adjustments
      ...config
    };

    console.log('[AdaptiveAudioChunker] Initialized with config:', this.config);
  }

  /**
   * Add audio data to the buffer and evaluate chunking decision - OPTIMIZED for sub-500ms processing
   */
    // @measureTime('AdaptiveAudioChunker.addAudioData')
    // @measureMemory('AdaptiveAudioChunker.addAudioData')
  public addAudioData(audioData: Float32Array): ChunkingDecision {
    this.audioBuffer.push(audioData);
    
    // OPTIMIZATION: Use fast pre-analysis for immediate decisions (Requirement 1.1)
    const quickDecision = this.performQuickAnalysis(audioData);
    if (quickDecision.shouldChunk) {
      return quickDecision;
    }
    
    // Perform full content analysis only when quick analysis doesn't trigger
    const analysis = this.analyzeContent();
    this.contentHistory.push(analysis);
    
    // Keep content history manageable (last 10 analyses)
    if (this.contentHistory.length > 10) {
      this.contentHistory.shift();
    }
    
    // Update silence tracking
    this.updateSilenceTracking(analysis);
    
    // Make chunking decision
    const decision = this.makeChunkingDecision(analysis);
    
    // Emit analysis for monitoring
    this.emit('content-analysis', analysis);
    
    return decision;
  }

  /**
   * Perform ultra-fast pre-analysis for immediate chunking decisions (Requirement 1.1)
   */
    // @measureTime('AdaptiveAudioChunker.performQuickAnalysis')
  private performQuickAnalysis(audioData: Float32Array): ChunkingDecision {
    const currentDuration = this.getCurrentBufferDuration();
    
    // Quick check 1: Maximum duration exceeded (hard limit)
    if (currentDuration >= this.config.maxChunkDuration * this.adaptiveMultiplier) {
      return {
        shouldChunk: true,
        reason: 'maxSize',
        confidence: 1.0,
        suggestedDelay: 50
      };
    }
    
    // Quick check 2: Immediate silence detection (Requirement 1.6)
    const rms = this.calculateRMS(audioData);
    if (rms < this.config.silenceThreshold && this.isInSilence) {
      const silenceDuration = Date.now() - this.silenceStartTime;
      if (silenceDuration >= this.config.silenceDuration * this.adaptiveMultiplier && 
          currentDuration >= this.config.minChunkDuration * 0.7) {
        return {
          shouldChunk: true,
          reason: 'silence',
          confidence: 0.95,
          suggestedDelay: 25 // Ultra-fast for silence
        };
      }
    }
    
    // Quick check 3: Immediate question marker detection (Requirement 1.5)
    if (currentDuration >= this.config.minChunkDuration * 0.6) {
      const hasQuestionMarkers = this.detectQuestionMarkers(audioData);
      if (hasQuestionMarkers) {
        return {
          shouldChunk: true,
          reason: 'content',
          confidence: 0.9,
          suggestedDelay: 50 // Fast for questions
        };
      }
    }
    
    // No immediate chunking needed
    return {
      shouldChunk: false,
      reason: 'content',
      confidence: 0.0,
      suggestedDelay: 100
    };
  }

  /**
   * Create a chunk from the current buffer
   */
    // @measureTime('AdaptiveAudioChunker.createChunk')
  public createChunk(): AudioChunk | null {
    if (this.audioBuffer.length === 0) {
      return null;
    }

    // Combine all audio data
    const totalLength = this.audioBuffer.reduce((acc, arr) => acc + arr.length, 0);
    const combinedArray = new Float32Array(totalLength);
    let offset = 0;
    
    for (const array of this.audioBuffer) {
      combinedArray.set(array, offset);
      offset += array.length;
    }

    const chunk: AudioChunk = {
      id: this.generateChunkId(),
      data: combinedArray,
      timestamp: Date.now(),
      duration: this.calculateDuration(totalLength),
      wordCount: this.estimateWordCount(combinedArray)
    };

    // Clear buffer and reset state
    this.audioBuffer = [];
    this.lastChunkTime = Date.now();
    this.silenceStartTime = 0;
    this.isInSilence = false;
    
    // Update adaptive multiplier based on recent performance
    this.updateAdaptiveMultiplier();

    console.log('[AdaptiveAudioChunker] Created chunk:', {
      id: chunk.id,
      duration: chunk.duration,
      wordCount: chunk.wordCount,
      dataLength: chunk.data.length
    });

    return chunk;
  }

  /**
   * Analyze audio content for chunking decisions
   */
    // @measureTime('AdaptiveAudioChunker.analyzeContent')
  private analyzeContent(): ContentAnalysis {
    if (this.audioBuffer.length === 0) {
      return {
        rmsLevel: 0,
        silenceDuration: 0,
        speechDensity: 0,
        energyVariance: 0,
        hasQuestionMarkers: false
      };
    }

    // Combine recent audio data for analysis
    const recentData = this.getRecentAudioData();
    
    // Calculate RMS level
    const rmsLevel = this.calculateRMS(recentData);
    
    // Calculate energy variance (measure of speech activity)
    const energyVariance = this.calculateEnergyVariance(recentData);
    
    // Estimate speech density
    const speechDensity = this.estimateSpeechDensity(recentData, rmsLevel);
    
    // Calculate current silence duration
    const silenceDuration = this.isInSilence ? Date.now() - this.silenceStartTime : 0;
    
    // Detect potential question markers (rising intonation patterns)
    const hasQuestionMarkers = this.detectQuestionMarkers(recentData);

    return {
      rmsLevel,
      silenceDuration,
      speechDensity,
      energyVariance,
      hasQuestionMarkers
    };
  }

  /**
   * Make chunking decision based on content analysis - OPTIMIZED for sub-500ms processing
   */
    // @measureTime('AdaptiveAudioChunker.makeChunkingDecision')
  private makeChunkingDecision(analysis: ContentAnalysis): ChunkingDecision {
    const now = Date.now();
    const timeSinceLastChunk = now - this.lastChunkTime;
    const currentDuration = this.getCurrentBufferDuration();
    
    // Apply adaptive multiplier to thresholds
    const adaptiveMinDuration = this.config.minChunkDuration * this.adaptiveMultiplier;
    const adaptiveMaxDuration = this.config.maxChunkDuration * this.adaptiveMultiplier;
    const adaptiveSilenceDuration = this.config.silenceDuration * this.adaptiveMultiplier;

    // ULTRA-FAST Decision 1: Immediate silence-based chunking (Requirement 1.6)
    if (analysis.silenceDuration >= adaptiveSilenceDuration && currentDuration >= adaptiveMinDuration) {
      return {
        shouldChunk: true,
        reason: 'silence',
        confidence: 0.95,
        suggestedDelay: 50 // Ultra-fast follow-up for silence-based chunks
      };
    }

    // ULTRA-FAST Decision 2: Question marker detection for immediate processing (Requirement 1.5)
    if (analysis.hasQuestionMarkers && currentDuration >= adaptiveMinDuration * 0.7) {
      return {
        shouldChunk: true,
        reason: 'content',
        confidence: 0.9,
        suggestedDelay: 75 // Quick processing for detected questions
      };
    }

    // Decision 3: Maximum duration reached (hard limit)
    if (currentDuration >= adaptiveMaxDuration) {
      return {
        shouldChunk: true,
        reason: 'maxSize',
        confidence: 1.0,
        suggestedDelay: 100
      };
    }

    // Decision 4: Content-based chunking with enhanced scoring (Requirement 1.1)
    if (currentDuration >= adaptiveMinDuration) {
      const contentScore = this.calculateContentScore(analysis);
      
      if (contentScore >= this.config.adaptiveThreshold) {
        return {
          shouldChunk: true,
          reason: 'content',
          confidence: contentScore,
          suggestedDelay: 150 // Moderate delay for content-based decisions
        };
      }
    }

    // Decision 5: Aggressive time-based fallback for ultra-fast processing (Requirement 1.1)
    if (timeSinceLastChunk >= adaptiveMaxDuration * 1.2) { // Reduced from 1.5x to 1.2x
      return {
        shouldChunk: true,
        reason: 'duration',
        confidence: 0.7,
        suggestedDelay: 200
      };
    }

    // No chunking needed
    return {
      shouldChunk: false,
      reason: 'content',
      confidence: 0.0,
      suggestedDelay: Math.min(100, Math.max(50, adaptiveMinDuration - currentDuration))
    };
  }

  /**
   * Update silence tracking state
   */
  private updateSilenceTracking(analysis: ContentAnalysis): void {
    const isSilent = analysis.rmsLevel < this.config.silenceThreshold;
    
    if (isSilent && !this.isInSilence) {
      // Entering silence
      this.isInSilence = true;
      this.silenceStartTime = Date.now();
    } else if (!isSilent && this.isInSilence) {
      // Exiting silence
      this.isInSilence = false;
      this.silenceStartTime = 0;
    }
  }

  /**
   * Calculate content score for chunking decisions - ENHANCED for ultra-fast processing
   */
  private calculateContentScore(analysis: ContentAnalysis): number {
    let score = 0;
    
    // Factor 1: Question markers boost score significantly (Requirement 1.5)
    if (analysis.hasQuestionMarkers) {
      score += 0.5; // Increased from 0.4 for faster question processing
    }
    
    // Factor 2: Low speech density suggests natural break
    if (analysis.speechDensity < 0.3) {
      score += 0.3;
    }
    
    // Factor 3: Low energy variance suggests end of utterance
    if (analysis.energyVariance < 0.1) {
      score += 0.25; // Slightly increased for better natural break detection
    }
    
    // Factor 4: Recent silence adds to score (Requirement 1.6)
    if (analysis.silenceDuration > this.config.silenceDuration * 0.4) { // Reduced threshold from 0.5 to 0.4
      score += 0.35; // Increased from 0.3 for faster silence-based processing
    }
    
    // Factor 5: Historical pattern analysis with enhanced weighting
    const historicalScore = this.analyzeHistoricalPatterns();
    score += historicalScore * 0.25; // Increased from 0.2 for better pattern recognition
    
    // Factor 6: NEW - Ultra-fast processing boost for high-confidence scenarios (Requirement 1.1)
    if (analysis.hasQuestionMarkers && analysis.silenceDuration > 0) {
      score += 0.2; // Bonus for question + silence combination
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Get recent audio data for analysis
   */
  private getRecentAudioData(): Float32Array {
    if (this.audioBuffer.length === 0) {
      return new Float32Array(0);
    }
    
    // Get data from the last analysis window
    const windowSamples = (this.config.contentAnalysisWindow / 1000) * this.config.sampleRate;
    const totalSamples = this.audioBuffer.reduce((acc, arr) => acc + arr.length, 0);
    
    if (totalSamples <= windowSamples) {
      // Return all data if less than window size
      const combined = new Float32Array(totalSamples);
      let offset = 0;
      for (const array of this.audioBuffer) {
        combined.set(array, offset);
        offset += array.length;
      }
      return combined;
    }
    
    // Return only the most recent window
    const recentData = new Float32Array(windowSamples);
    let remaining = windowSamples;
    let bufferIndex = this.audioBuffer.length - 1;
    let offset = windowSamples;
    
    while (remaining > 0 && bufferIndex >= 0) {
      const buffer = this.audioBuffer[bufferIndex];
      const copyLength = Math.min(remaining, buffer.length);
      const startIndex = Math.max(0, buffer.length - copyLength);
      
      offset -= copyLength;
      recentData.set(buffer.subarray(startIndex, startIndex + copyLength), offset);
      remaining -= copyLength;
      bufferIndex--;
    }
    
    return recentData;
  }

  /**
   * Calculate RMS (Root Mean Square) level of audio data
   */
  private calculateRMS(data: Float32Array): number {
    if (data.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    
    return Math.sqrt(sum / data.length);
  }

  /**
   * Calculate energy variance to detect speech activity
   */
  private calculateEnergyVariance(data: Float32Array): number {
    if (data.length === 0) return 0;
    
    const frameSize = Math.floor(this.config.sampleRate * 0.025); // 25ms frames
    const frames: number[] = [];
    
    for (let i = 0; i < data.length - frameSize; i += frameSize) {
      const frame = data.subarray(i, i + frameSize);
      const energy = this.calculateRMS(frame);
      frames.push(energy);
    }
    
    if (frames.length < 2) return 0;
    
    const mean = frames.reduce((sum, val) => sum + val, 0) / frames.length;
    const variance = frames.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frames.length;
    
    return variance;
  }

  /**
   * Estimate speech density in the audio data
   */
  private estimateSpeechDensity(data: Float32Array, rmsLevel: number): number {
    if (data.length === 0) return 0;
    
    const frameSize = Math.floor(this.config.sampleRate * 0.025); // 25ms frames
    let speechFrames = 0;
    let totalFrames = 0;
    
    for (let i = 0; i < data.length - frameSize; i += frameSize) {
      const frame = data.subarray(i, i + frameSize);
      const frameRMS = this.calculateRMS(frame);
      
      if (frameRMS > this.config.silenceThreshold * 2) {
        speechFrames++;
      }
      totalFrames++;
    }
    
    return totalFrames > 0 ? speechFrames / totalFrames : 0;
  }

  /**
   * Detect potential question markers (rising intonation patterns) - ENHANCED for immediate processing
   */
  private detectQuestionMarkers(data: Float32Array): boolean {
    if (data.length === 0) return false;
    
    const frameSize = Math.floor(this.config.sampleRate * 0.040); // Reduced from 50ms to 40ms for faster detection
    const energyLevels: number[] = [];
    
    // Calculate energy levels for frames
    for (let i = 0; i < data.length - frameSize; i += frameSize) {
      const frame = data.subarray(i, i + frameSize);
      const energy = this.calculateRMS(frame);
      energyLevels.push(energy);
    }
    
    if (energyLevels.length < 3) return false; // Reduced from 4 to 3 for faster detection
    
    // Enhanced question marker detection with multiple patterns
    
    // Pattern 1: Rising intonation in the last portion (traditional question pattern)
    const lastQuarter = energyLevels.slice(-Math.max(2, Math.floor(energyLevels.length / 4)));
    let risingCount = 0;
    for (let i = 1; i < lastQuarter.length; i++) {
      if (lastQuarter[i] > lastQuarter[i - 1]) {
        risingCount++;
      }
    }
    const hasRisingIntonation = risingCount >= lastQuarter.length * 0.5; // Reduced from 0.6 to 0.5
    
    // Pattern 2: Energy spike at the end (emphatic question)
    const avgEnergy = energyLevels.reduce((sum, val) => sum + val, 0) / energyLevels.length;
    const lastFrameEnergy = energyLevels[energyLevels.length - 1];
    const hasEnergySpike = lastFrameEnergy > avgEnergy * 1.3;
    
    // Pattern 3: Distinctive energy pattern (question-like rhythm)
    let energyVariations = 0;
    for (let i = 1; i < energyLevels.length; i++) {
      const change = Math.abs(energyLevels[i] - energyLevels[i - 1]);
      if (change > avgEnergy * 0.2) {
        energyVariations++;
      }
    }
    const hasQuestionRhythm = energyVariations >= Math.floor(energyLevels.length * 0.4);
    
    // Return true if any question pattern is detected (Requirement 1.5 - immediate processing triggers)
    return hasRisingIntonation || hasEnergySpike || hasQuestionRhythm;
  }

  /**
   * Analyze historical patterns for better chunking decisions
   */
  private analyzeHistoricalPatterns(): number {
    if (this.contentHistory.length < 3) return 0;
    
    const recent = this.contentHistory.slice(-3);
    let score = 0;
    
    // Pattern 1: Consistent silence increase suggests natural break
    const silenceIncreasing = recent.every((analysis, index) => 
      index === 0 || analysis.silenceDuration >= recent[index - 1].silenceDuration
    );
    
    if (silenceIncreasing) score += 0.3;
    
    // Pattern 2: Decreasing speech density suggests end of utterance
    const densityDecreasing = recent.every((analysis, index) => 
      index === 0 || analysis.speechDensity <= recent[index - 1].speechDensity
    );
    
    if (densityDecreasing) score += 0.2;
    
    // Pattern 3: Question markers in recent history
    const hasRecentQuestionMarkers = recent.some(analysis => analysis.hasQuestionMarkers);
    if (hasRecentQuestionMarkers) score += 0.5;
    
    return Math.min(score, 1.0);
  }

  /**
   * Update adaptive multiplier based on recent performance
   */
  private updateAdaptiveMultiplier(): void {
    // This would be enhanced with actual performance metrics
    // For now, implement basic adaptation based on content history
    
    if (this.contentHistory.length < 5) return;
    
    const recentAnalyses = this.contentHistory.slice(-5);
    const avgSpeechDensity = recentAnalyses.reduce((sum, a) => sum + a.speechDensity, 0) / recentAnalyses.length;
    
    // Adjust multiplier based on speech density
    if (avgSpeechDensity > 0.7) {
      // High speech density - reduce chunk duration for faster processing
      this.adaptiveMultiplier = Math.max(0.7, this.adaptiveMultiplier - 0.1);
    } else if (avgSpeechDensity < 0.3) {
      // Low speech density - increase chunk duration to avoid over-chunking
      this.adaptiveMultiplier = Math.min(1.3, this.adaptiveMultiplier + 0.1);
    }
    
    console.log('[AdaptiveAudioChunker] Updated adaptive multiplier:', this.adaptiveMultiplier);
  }

  /**
   * Calculate duration of current buffer in milliseconds
   */
  private getCurrentBufferDuration(): number {
    const totalSamples = this.audioBuffer.reduce((acc, arr) => acc + arr.length, 0);
    return this.calculateDuration(totalSamples);
  }

  /**
   * Calculate duration from sample count
   */
  private calculateDuration(sampleCount: number): number {
    return (sampleCount / this.config.sampleRate) * 1000;
  }

  /**
   * Estimate word count from audio data
   */
  private estimateWordCount(data: Float32Array): number {
    // Simple estimation: assume average word duration of 600ms
    const duration = this.calculateDuration(data.length);
    return Math.floor(duration / 600);
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current configuration
   */
  public getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[AdaptiveAudioChunker] Configuration updated:', this.config);
  }

  /**
   * Get current state for monitoring
   */
  public getState() {
    return {
      bufferLength: this.audioBuffer.length,
      currentDuration: this.getCurrentBufferDuration(),
      isInSilence: this.isInSilence,
      silenceDuration: this.isInSilence ? Date.now() - this.silenceStartTime : 0,
      adaptiveMultiplier: this.adaptiveMultiplier,
      contentHistoryLength: this.contentHistory.length
    };
  }

  /**
   * Clear all buffers and reset state
   */
  public reset(): void {
    this.audioBuffer = [];
    this.lastChunkTime = 0;
    this.silenceStartTime = 0;
    this.isInSilence = false;
    this.contentHistory = [];
    this.adaptiveMultiplier = 1.0;
    
    console.log('[AdaptiveAudioChunker] Reset complete');
  }
}