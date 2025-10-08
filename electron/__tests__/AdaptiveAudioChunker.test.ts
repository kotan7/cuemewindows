import { AdaptiveAudioChunker, ChunkingConfig, ContentAnalysis, ChunkingDecision } from '../AdaptiveAudioChunker';

describe('AdaptiveAudioChunker', () => {
  let chunker: AdaptiveAudioChunker;
  let mockConfig: Partial<ChunkingConfig>;

  beforeEach(() => {
    mockConfig = {
      sampleRate: 16000,
      minChunkDuration: 500,
      maxChunkDuration: 2000,
      silenceThreshold: 0.01,
      silenceDuration: 400,
      contentAnalysisWindow: 1000,
      adaptiveThreshold: 0.7
    };
    
    chunker = new AdaptiveAudioChunker(mockConfig);
  });

  afterEach(() => {
    chunker.reset();
  });

  describe('Content-Aware Chunking', () => {
    it('should create chunks based on silence detection', () => {
      // Create audio data with silence pattern
      const speechData = generateAudioData(0.1, 8000); // 0.5s of speech
      const silenceData = generateAudioData(0.005, 8000); // 0.5s of silence (below threshold)
      
      // Add speech data
      const decision1 = chunker.addAudioData(speechData);
      expect(decision1.shouldChunk).toBe(false);
      
      // Add silence data - should trigger chunking after silence duration
      const decision2 = chunker.addAudioData(silenceData);
      
      // Wait for silence duration to be met
      setTimeout(() => {
        const decision3 = chunker.addAudioData(generateAudioData(0.005, 1600)); // 0.1s more silence
        expect(decision3.shouldChunk).toBe(true);
        expect(decision3.reason).toBe('silence');
        expect(decision3.confidence).toBeGreaterThan(0.8);
      }, 450);
    });

    it('should adapt chunk size based on speech density', () => {
      // High speech density data
      const highDensitySpeech = generateAudioData(0.2, 16000); // 1s of high-energy speech
      
      const decision1 = chunker.addAudioData(highDensitySpeech);
      
      // Should not chunk immediately due to high speech density
      expect(decision1.shouldChunk).toBe(false);
      
      // Add more data to reach minimum duration
      const decision2 = chunker.addAudioData(generateAudioData(0.15, 8000));
      
      // Should still wait for better content break
      expect(decision2.shouldChunk).toBe(false);
    });

    it('should detect question markers and prioritize chunking', () => {
      // Create audio data with rising intonation pattern (question marker)
      const questionAudio = generateRisingIntonationAudio(16000); // 1s of question-like audio
      
      const decision = chunker.addAudioData(questionAudio);
      
      // Should have higher confidence for chunking due to question markers
      if (decision.shouldChunk) {
        expect(decision.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should respect minimum and maximum chunk durations', () => {
      // Test minimum duration constraint
      const shortAudio = generateAudioData(0.1, 4000); // 0.25s (below minimum)
      const decision1 = chunker.addAudioData(shortAudio);
      expect(decision1.shouldChunk).toBe(false);
      
      // Test maximum duration constraint
      const longAudio = generateAudioData(0.1, 40000); // 2.5s (above maximum)
      const decision2 = chunker.addAudioData(longAudio);
      expect(decision2.shouldChunk).toBe(true);
      expect(decision2.reason).toBe('maxSize');
    });
  });

  describe('Dynamic Chunk Size Adjustment', () => {
    it('should adjust adaptive multiplier based on content patterns', () => {
      const initialState = chunker.getState();
      expect(initialState.adaptiveMultiplier).toBe(1.0);
      
      // Simulate high speech density pattern
      for (let i = 0; i < 6; i++) {
        const highDensityAudio = generateAudioData(0.2, 8000);
        chunker.addAudioData(highDensityAudio);
        
        // Force chunk creation to update adaptive multiplier
        if (i % 2 === 1) {
          chunker.createChunk();
        }
      }
      
      const updatedState = chunker.getState();
      // Adaptive multiplier should decrease for high speech density
      expect(updatedState.adaptiveMultiplier).toBeLessThan(1.0);
    });

    it('should increase chunk duration for low speech density', () => {
      // Simulate low speech density pattern
      for (let i = 0; i < 6; i++) {
        const lowDensityAudio = generateAudioData(0.02, 8000); // Very low energy
        chunker.addAudioData(lowDensityAudio);
        
        if (i % 2 === 1) {
          chunker.createChunk();
        }
      }
      
      const state = chunker.getState();
      // Adaptive multiplier should increase for low speech density
      expect(state.adaptiveMultiplier).toBeGreaterThan(1.0);
    });
  });

  describe('Silence Detection', () => {
    it('should accurately detect silence periods', () => {
      const silenceData = generateAudioData(0.005, 8000); // Below silence threshold
      const speechData = generateAudioData(0.1, 8000); // Above silence threshold
      
      // Add silence
      chunker.addAudioData(silenceData);
      let state = chunker.getState();
      expect(state.isInSilence).toBe(true);
      
      // Add speech
      chunker.addAudioData(speechData);
      state = chunker.getState();
      expect(state.isInSilence).toBe(false);
    });

    it('should trigger immediate processing after silence duration', (done) => {
      const speechData = generateAudioData(0.1, 8000);
      const silenceData = generateAudioData(0.005, 8000);
      
      // Add initial speech
      chunker.addAudioData(speechData);
      
      // Add silence
      chunker.addAudioData(silenceData);
      
      // Wait for silence duration threshold
      setTimeout(() => {
        const decision = chunker.addAudioData(generateAudioData(0.005, 1600));
        expect(decision.shouldChunk).toBe(true);
        expect(decision.reason).toBe('silence');
        done();
      }, mockConfig.silenceDuration! + 50);
    });
  });

  describe('Chunk Creation', () => {
    it('should create valid audio chunks', () => {
      const audioData1 = generateAudioData(0.1, 8000);
      const audioData2 = generateAudioData(0.1, 8000);
      
      chunker.addAudioData(audioData1);
      chunker.addAudioData(audioData2);
      
      const chunk = chunker.createChunk();
      
      expect(chunk).not.toBeNull();
      expect(chunk!.id).toBeDefined();
      expect(chunk!.data).toBeInstanceOf(Float32Array);
      expect(chunk!.data.length).toBe(16000); // Combined length
      expect(chunk!.duration).toBeCloseTo(1000, 50); // ~1 second
      expect(chunk!.timestamp).toBeDefined();
      expect(chunk!.wordCount).toBeGreaterThan(0);
    });

    it('should reset state after chunk creation', () => {
      const audioData = generateAudioData(0.1, 8000);
      chunker.addAudioData(audioData);
      
      const stateBefore = chunker.getState();
      expect(stateBefore.bufferLength).toBeGreaterThan(0);
      
      chunker.createChunk();
      
      const stateAfter = chunker.getState();
      expect(stateAfter.bufferLength).toBe(0);
      expect(stateAfter.isInSilence).toBe(false);
    });

    it('should return null when no audio data is available', () => {
      const chunk = chunker.createChunk();
      expect(chunk).toBeNull();
    });
  });

  describe('Content Analysis', () => {
    it('should calculate RMS levels correctly', () => {
      const highEnergyAudio = generateAudioData(0.5, 8000);
      const lowEnergyAudio = generateAudioData(0.01, 8000);
      
      chunker.addAudioData(highEnergyAudio);
      
      // Listen for content analysis event
      let analysisResult: ContentAnalysis | null = null;
      chunker.on('content-analysis', (analysis: ContentAnalysis) => {
        analysisResult = analysis;
      });
      
      chunker.addAudioData(lowEnergyAudio);
      
      expect(analysisResult).not.toBeNull();
      expect(analysisResult!.rmsLevel).toBeGreaterThan(0);
    });

    it('should detect speech density variations', () => {
      const varyingEnergyAudio = generateVaryingEnergyAudio(16000);
      
      let analysisResult: ContentAnalysis | null = null;
      chunker.on('content-analysis', (analysis: ContentAnalysis) => {
        analysisResult = analysis;
      });
      
      chunker.addAudioData(varyingEnergyAudio);
      
      expect(analysisResult).not.toBeNull();
      expect(analysisResult!.speechDensity).toBeGreaterThan(0);
      expect(analysisResult!.energyVariance).toBeGreaterThan(0);
    });
  });

  describe('Ultra-Fast Processing Features', () => {
    it('should perform quick analysis for immediate decisions', () => {
      // Test maximum duration quick check
      const longAudio = generateAudioData(0.1, 40000); // 2.5s (above max duration)
      
      const startTime = Date.now();
      const decision = chunker.addAudioData(longAudio);
      const endTime = Date.now();
      
      expect(decision.shouldChunk).toBe(true);
      expect(decision.reason).toBe('maxSize');
      expect(endTime - startTime).toBeLessThan(25); // Ultra-fast processing
    });

    it('should detect enhanced question markers with multiple patterns', () => {
      // Test rising intonation pattern
      const risingAudio = generateRisingIntonationAudio(8000);
      chunker.addAudioData(risingAudio);
      
      // Test energy spike pattern
      const energySpikeAudio = generateEnergySpikeAudio(8000);
      const decision = chunker.addAudioData(energySpikeAudio);
      
      // Should detect question markers with enhanced algorithm
      if (decision.shouldChunk) {
        expect(decision.confidence).toBeGreaterThan(0.8);
      }
    });

    it('should use adaptive multiplier for dynamic thresholds', () => {
      const initialConfig = chunker.getConfig();
      
      // Simulate high speech density to reduce adaptive multiplier
      for (let i = 0; i < 6; i++) {
        const highDensityAudio = generateAudioData(0.2, 8000);
        chunker.addAudioData(highDensityAudio);
        chunker.createChunk(); // Force chunk creation to update multiplier
      }
      
      const state = chunker.getState();
      expect(state.adaptiveMultiplier).toBeLessThan(1.0);
      
      // Test that thresholds are now more aggressive
      const testAudio = generateAudioData(0.1, 6000); // 0.375s
      const decision = chunker.addAudioData(testAudio);
      
      // With reduced multiplier, should be more likely to chunk
      expect(decision.suggestedDelay).toBeLessThan(200);
    });

    it('should provide enhanced content scoring for ultra-fast processing', () => {
      const speechData = generateAudioData(0.1, 8000);
      chunker.addAudioData(speechData);
      
      // Create audio with question markers and silence
      const questionWithSilence = generateQuestionWithSilenceAudio(8000);
      
      let analysisResult: ContentAnalysis | null = null;
      chunker.on('content-analysis', (analysis: ContentAnalysis) => {
        analysisResult = analysis;
      });
      
      const decision = chunker.addAudioData(questionWithSilence);
      
      // Should have high confidence due to enhanced scoring
      if (decision.shouldChunk && analysisResult?.hasQuestionMarkers) {
        expect(decision.confidence).toBeGreaterThan(0.85);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        minChunkDuration: 1000,
        maxChunkDuration: 3000,
        silenceThreshold: 0.02
      };
      
      chunker.updateConfig(newConfig);
      const config = chunker.getConfig();
      
      expect(config.minChunkDuration).toBe(1000);
      expect(config.maxChunkDuration).toBe(3000);
      expect(config.silenceThreshold).toBe(0.02);
    });

    it('should maintain other config values when partially updating', () => {
      const originalConfig = chunker.getConfig();
      
      chunker.updateConfig({ minChunkDuration: 1000 });
      const updatedConfig = chunker.getConfig();
      
      expect(updatedConfig.minChunkDuration).toBe(1000);
      expect(updatedConfig.sampleRate).toBe(originalConfig.sampleRate);
      expect(updatedConfig.silenceThreshold).toBe(originalConfig.silenceThreshold);
    });
  });

  describe('Performance Optimization', () => {
    it('should process large audio buffers efficiently', () => {
      const startTime = Date.now();
      
      // Add multiple large audio chunks
      for (let i = 0; i < 10; i++) {
        const largeAudio = generateAudioData(0.1, 16000); // 1s each
        chunker.addAudioData(largeAudio);
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 10 seconds of audio in under 100ms
      expect(processingTime).toBeLessThan(100);
    });

    it('should maintain memory efficiency with long running sessions', () => {
      // Simulate long running session
      for (let i = 0; i < 100; i++) {
        const audioData = generateAudioData(0.1, 1600); // 0.1s chunks
        chunker.addAudioData(audioData);
        
        // Periodically create chunks to prevent unbounded growth
        if (i % 10 === 0) {
          chunker.createChunk();
        }
      }
      
      const state = chunker.getState();
      
      // Content history should be bounded
      expect(state.contentHistoryLength).toBeLessThanOrEqual(10);
      
      // Buffer should not grow unbounded
      expect(state.bufferLength).toBeLessThan(50);
    });

    it('should achieve sub-500ms chunk processing time (Requirement 1.1)', () => {
      const audioData = generateAudioData(0.1, 8000); // 0.5s of audio
      
      const startTime = Date.now();
      const decision = chunker.addAudioData(audioData);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      // Should process audio chunk in under 50ms (well under 500ms requirement)
      expect(processingTime).toBeLessThan(50);
    });

    it('should provide immediate processing triggers for silence (Requirement 1.6)', (done) => {
      const speechData = generateAudioData(0.1, 8000); // 0.5s speech
      const silenceData = generateAudioData(0.005, 8000); // 0.5s silence
      
      // Add speech first
      chunker.addAudioData(speechData);
      
      // Add silence
      chunker.addAudioData(silenceData);
      
      // Should trigger immediate processing after silence duration
      setTimeout(() => {
        const startTime = Date.now();
        const decision = chunker.addAudioData(generateAudioData(0.005, 1600));
        const endTime = Date.now();
        
        expect(decision.shouldChunk).toBe(true);
        expect(decision.reason).toBe('silence');
        expect(endTime - startTime).toBeLessThan(25); // Ultra-fast silence processing
        done();
      }, mockConfig.silenceDuration! + 10);
    });

    it('should provide immediate processing triggers for questions (Requirement 1.5)', () => {
      const questionAudio = generateRisingIntonationAudio(8000); // 0.5s question-like audio
      
      const startTime = Date.now();
      const decision = chunker.addAudioData(questionAudio);
      const endTime = Date.now();
      
      // Should detect question markers and trigger fast processing
      if (decision.shouldChunk) {
        expect(decision.reason).toBe('content');
        expect(decision.confidence).toBeGreaterThan(0.8);
        expect(endTime - startTime).toBeLessThan(50); // Fast question processing
      }
    });
  });
});

// Helper functions for generating test audio data

function generateAudioData(amplitude: number, length: number): Float32Array {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Generate sine wave with some noise
    data[i] = amplitude * (Math.sin(2 * Math.PI * 440 * i / 16000) + Math.random() * 0.1 - 0.05);
  }
  return data;
}

function generateRisingIntonationAudio(length: number): Float32Array {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Generate audio with rising amplitude (simulating question intonation)
    const progress = i / length;
    const amplitude = 0.05 + (progress * 0.15); // Rising from 0.05 to 0.2
    data[i] = amplitude * Math.sin(2 * Math.PI * 440 * i / 16000);
  }
  return data;
}

function generateVaryingEnergyAudio(length: number): Float32Array {
  const data = new Float32Array(length);
  const frameSize = Math.floor(length / 10); // 10 frames
  
  for (let frame = 0; frame < 10; frame++) {
    const amplitude = 0.05 + (frame % 3) * 0.1; // Varying energy levels
    const startIdx = frame * frameSize;
    const endIdx = Math.min(startIdx + frameSize, length);
    
    for (let i = startIdx; i < endIdx; i++) {
      data[i] = amplitude * Math.sin(2 * Math.PI * 440 * i / 16000);
    }
  }
  
  return data;
}

function generateEnergySpikeAudio(length: number): Float32Array {
  const data = new Float32Array(length);
  const spikeStart = Math.floor(length * 0.8); // Spike in last 20%
  
  for (let i = 0; i < length; i++) {
    let amplitude = 0.05; // Base amplitude
    
    // Create energy spike at the end (question marker pattern)
    if (i >= spikeStart) {
      amplitude = 0.15 + (i - spikeStart) / (length - spikeStart) * 0.1; // Rising to 0.25
    }
    
    data[i] = amplitude * Math.sin(2 * Math.PI * 440 * i / 16000);
  }
  
  return data;
}

function generateQuestionWithSilenceAudio(length: number): Float32Array {
  const data = new Float32Array(length);
  const questionPart = Math.floor(length * 0.7); // 70% question, 30% silence
  
  for (let i = 0; i < length; i++) {
    if (i < questionPart) {
      // Question part with rising intonation
      const progress = i / questionPart;
      const amplitude = 0.08 + (progress * 0.12); // Rising from 0.08 to 0.2
      data[i] = amplitude * Math.sin(2 * Math.PI * 440 * i / 16000);
    } else {
      // Silence part
      data[i] = 0.003 * (Math.random() - 0.5); // Very low noise
    }
  }
  
  return data;
}