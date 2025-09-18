import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { QuestionDetector } from "./QuestionDetector";
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
  private questionDetector: QuestionDetector;
  private openai: OpenAI;
  
  // Audio processing
  private currentAudioData: Float32Array[] = [];
  private lastSilenceTime: number = 0;
  private wordCount: number = 0;
  private tempBuffer: Float32Array | null = null;
  private lastChunkTime: number = 0;
  private accumulatedSamples: number = 0;
  
  // NEW: Question activity tracking for ultra-fast detection
  private recentAudioBuffer: string[] = []; // Store recent audio patterns
  private lastQuestionHintTime: number = 0;
  
  // NEW: Streaming detection state
  private streamingBuffer: string = ''; // Accumulate partial transcriptions
  private lastStreamingCheck: number = 0;

  // Japanese filler words and patterns to remove
  private readonly fillerWords = new Set([
    'えー', 'あー', 'うー', 'んー', 'そのー', 'あのー', 'えーっと', 'あーと',
    'まあ', 'なんか', 'ちょっと', 'やっぱり', 'やっぱ', 'だから', 'でも',
    'うん', 'はい', 'そう', 'ですね', 'ですが', 'ただ', 'まず', 'それで',
    'というか', 'てか', 'なので', 'けど', 'けれど', 'しかし', 'でも',
    'ー', '〜', 'う〜ん', 'え〜', 'あ〜', 'そ〜', 'ん〜',
    // Additional fillers
    'じゃあ', 'では', 'それでは', 'さて', 'ちなみに', 'ところで', 'えっと', 'えと',
    'あの', 'その', 'とりあえず', 'まぁ', 'まぁその', 'なんていうか'
  ]);

  private readonly questionStarters = new Set([
    'どう', 'どの', 'どこ', 'いつ', 'なぜ', 'なん', '何', 'だれ', '誰',
    'どちら', 'どれ', 'いくら', 'いくつ', 'どのよう', 'どんな'
  ]);

  constructor(openaiApiKey: string, config?: Partial<AudioStreamConfig>) {
    super();
    
    // Validate OpenAI API key
    if (!openaiApiKey || openaiApiKey.trim() === '') {
      throw new Error('OpenAI API key is required for AudioStreamProcessor');
    }
    
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.questionDetector = new QuestionDetector();
    
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
      }
    };

    console.log('[AudioStreamProcessor] Initialized with immediate question refinement');
  }

  /**
   * Start always-on audio listening
   */
  public async startListening(): Promise<void> {
    if (this.state.isListening) {
      console.log('[AudioStreamProcessor] Already listening');
      return;
    }

    try {
      this.state.isListening = true;
      this.state.lastActivityTime = Date.now();
      this.emit('state-changed', { ...this.state });
      
      console.log('[AudioStreamProcessor] Started listening for audio');
      
    } catch (error) {
      this.state.isListening = false;
      console.error('[AudioStreamProcessor] Failed to start listening:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop audio listening
   */
  public async stopListening(): Promise<void> {
    if (!this.state.isListening) {
      console.log('[AudioStreamProcessor] Not currently listening');
      return;
    }

    try {
      this.state.isListening = false;
      this.state.isProcessing = false;
      
      // Clear any pending audio data
      this.currentAudioData = [];
      this.wordCount = 0;
      
      this.emit('state-changed', { ...this.state });
      console.log('[AudioStreamProcessor] Stopped listening');
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error stopping listening:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Process audio data chunk received from renderer
   */
  public async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.state.isListening) {
      console.log('[AudioStreamProcessor] Not listening, ignoring audio chunk');
      return;
    }

    try {
      console.log('[AudioStreamProcessor] Processing audio chunk of size:', audioData.length);
      
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
      const shouldCreateChunk = await this.shouldCreateChunk();
      
      if (shouldCreateChunk) {
        console.log('[AudioStreamProcessor] Creating and processing chunk');
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
    
    // Calculate time since last chunk
    const timeSinceLastChunk = now - this.lastChunkTime;
    
    // Calculate accumulated audio duration (assuming 16kHz sample rate)
    const accumulatedDuration = (this.accumulatedSamples / this.config.sampleRate) * 1000;
    
    // ULTRA AGGRESSIVE: Create chunk if:
    // 1. We have accumulated 2+ seconds of audio (reduced from 5s) OR
    // 2. We haven't created a chunk in 4+ seconds (reduced from 10s) OR  
    // 3. Word count exceeds limit OR
    // 4. We detect potential question markers in recent audio
    const shouldCreateByDuration = accumulatedDuration >= 2000; // 2s instead of 5s
    const shouldCreateByTime = timeSinceLastChunk >= 4000; // 4s instead of 10s
    const shouldCreateByWords = this.wordCount >= this.config.maxWords;
    
    // NEW: Quick heuristic check for question-like audio patterns
    const shouldCreateByQuestionHint = this.hasRecentQuestionActivity();
    
    const shouldCreate = shouldCreateByDuration || shouldCreateByTime || shouldCreateByWords || shouldCreateByQuestionHint;
    
    if (shouldCreate) {
      console.log('[AudioStreamProcessor] Creating chunk - Duration:', accumulatedDuration.toFixed(0), 'ms, Time since last:', timeSinceLastChunk.toFixed(0), 'ms, Words:', this.wordCount, 'QuestionHint:', shouldCreateByQuestionHint);
    }
    
    return shouldCreate;
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
    if (!this.config.questionDetectionEnabled) {
      console.log('[AudioStreamProcessor] Question detection disabled, skipping transcription');
      return;
    }

    try {
      console.log('[AudioStreamProcessor] Starting transcription for chunk:', {
        id: chunk.id,
        duration: chunk.duration,
        dataLength: chunk.data.length,
        timestamp: chunk.timestamp
      });
      
      this.state.isProcessing = true;
      this.emit('state-changed', { ...this.state });

      // Convert to PCM buffer for Whisper API
      const pcmBuffer = Buffer.alloc(chunk.data.length * 2);
      for (let i = 0; i < chunk.data.length; i++) {
        const sample = Math.max(-1, Math.min(1, chunk.data[i]));
        const value = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
        pcmBuffer.writeInt16LE(value, i * 2);
      }
      
      console.log('[AudioStreamProcessor] Created PCM buffer, size:', pcmBuffer.length);
      const tempFilePath = await this.createTempAudioFile(pcmBuffer);
      console.log('[AudioStreamProcessor] Created WAV file:', tempFilePath);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "ja",
        response_format: "json",
        temperature: 0.2
      });
      
      console.log('[AudioStreamProcessor] Whisper transcription result:', {
        text: transcription.text,
        textLength: transcription.text?.length || 0
      });

      // Clean up temp file
      await this.cleanupTempFile(tempFilePath);

      const result: TranscriptionResult = {
        id: uuidv4(),
        text: transcription.text || "",
        timestamp: chunk.timestamp,
        confidence: 1.0,
        isQuestion: false,
        originalChunkId: chunk.id
      };

      this.emit('transcription-completed', result);

      // NEW: Update recent audio buffer for question hint detection
      this.updateRecentAudioBuffer(result.text);

      // NEW: Streaming question detection - check immediately on each transcription
      this.performStreamingQuestionDetection(result.text);

      // Detect and immediately refine questions
      if (result.text.trim()) {
        console.log('[AudioStreamProcessor] Processing transcription for questions:', result.text);
        await this.detectAndRefineQuestions(result);
      } else {
        console.log('[AudioStreamProcessor] No text in transcription result');
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
      console.log(`[AudioStreamProcessor] Detecting questions in: "${transcription.text}"`);
      
      // ULTRA OPTIMIZATION: Skip empty or very short transcriptions
      if (!transcription.text || transcription.text.trim().length < 3) {
        console.log('[AudioStreamProcessor] Skipping question detection - text too short');
        return;
      }

      const detectedQuestion = this.questionDetector.detectQuestion(transcription);

      // Use either detector output or fall back to full transcription for heuristics
      const baseText = detectedQuestion ? detectedQuestion.text : transcription.text;

      // Split possible multiple questions, trim preface, and refine each
      const questionParts = this.splitIntoQuestions(baseText);

      if (questionParts.length === 0) {
        console.log('[AudioStreamProcessor] No questions detected');
        return;
      }

      console.log(`[AudioStreamProcessor] Found ${questionParts.length} potential questions:`, questionParts);

      // Process each question part with PARALLEL processing for speed
      const questionPromises = questionParts.map(async (part) => {
        const core = this.trimPreface(part);
        if (!core || core.trim().length < 2) return null;

        const tempQuestion: DetectedQuestion = {
          id: uuidv4(),
          text: core.trim(),
          timestamp: detectedQuestion ? detectedQuestion.timestamp : transcription.timestamp,
          confidence: detectedQuestion ? detectedQuestion.confidence : transcription.confidence
        };

        // Validate by either the detector's rules or our heuristic recognizer
        if (!this.questionDetector.isValidQuestion(tempQuestion) && !this.looksLikeQuestion(core)) {
          return null;
        }

        const refinedText = this.refineQuestionAlgorithmically(core);

        const refinedQuestion: DetectedQuestion & { refinedText?: string } = {
          ...tempQuestion,
          refinedText
        };

        console.log(`[AudioStreamProcessor] ULTRA-FAST Question detected: "${refinedText}"`);
        return refinedQuestion;
      });

      // Wait for all parallel processing to complete
      const allQuestions = (await Promise.all(questionPromises)).filter(q => q !== null);
      
      // Add valid questions to state and emit immediately
      for (const question of allQuestions) {
        if (question) {
          this.state.questionBuffer.push(question);
          this.emit('question-detected', question);
          console.log(`[AudioStreamProcessor] ULTRA-FAST Question emitted: "${question.text}"`);
        }
      }

      // Emit state change if we added any questions
      if (allQuestions.length > 0) {
        this.emit('state-changed', { ...this.state });
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Question detection error:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Algorithmically refine question text by removing fillers and cleaning up
   */
  private refineQuestionAlgorithmically(text: string): string {
    console.log('[AudioStreamProcessor] Starting algorithmic refinement for:', text);
    
    try {
      let refined = text.toLowerCase().trim();
      
      // Step 1: Remove common Japanese filler words
      const words = refined.split(/[\s、。！？]+/).filter(word => word.length > 0);
      const cleanedWords = words.filter(word => !this.fillerWords.has(word));
      
      // Step 2: Remove repetitive patterns (like "あのあの", "えーえー")
      const deduplicatedWords: string[] = [];
      let lastWord = '';
      for (const word of cleanedWords) {
        if (word !== lastWord || !this.fillerWords.has(word)) {
          deduplicatedWords.push(word);
        }
        lastWord = word;
      }
      
      // Step 3: Rejoin and clean up spacing
      refined = deduplicatedWords.join(' ');
      
      // Step 4: Remove multiple spaces and normalize
      refined = refined.replace(/\s+/g, ' ').trim();
      
      // Step 5: Remove trailing particles that don't add meaning to questions
      refined = refined.replace(/[、。！？\s]*$/, '');
      refined = refined.replace(/\s*(です|ます|だ|である|でしょう|かな|よね)?\s*$/i, '');
      
      // Step 6: Ensure question ends appropriately
      if (!refined.endsWith('？') && !refined.endsWith('?')) {
        // Check if it's actually a question by looking for question words
        const hasQuestionWord = Array.from(this.questionStarters).some(starter => 
          refined.includes(starter)
        );
        
        if (hasQuestionWord || this.looksLikeQuestion(refined)) {
          refined += '？';
        }
      }
      
      // Step 7: Capitalize first character if it's a Latin character
      if (refined.length > 0 && /[a-zA-Z]/.test(refined[0])) {
        refined = refined[0].toUpperCase() + refined.slice(1);
      }
      
      // Fallback: if we cleaned too much, return original
      if (refined.length < 3 || refined.replace(/[？?]/g, '').trim().length < 2) {
        console.log('[AudioStreamProcessor] Refinement too aggressive, using original');
        return text;
      }
      
      console.log('[AudioStreamProcessor] Algorithmic refinement complete:', {
        original: text,
        refined: refined,
        removedWords: words.length - cleanedWords.length
      });
      
      return refined;
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error in algorithmic refinement:', error);
      return text; // Return original on error
    }
  }

  /**
   * Check if text structure looks like a question
   */
  private looksLikeQuestion(text: string): boolean {
    // Check for interrogative patterns in Japanese
    const questionPatterns = [
      /どう.*/, /どの.*/, /どこ.*/, /いつ.*/, /なぜ.*/, /なん.*/, /何.*/, 
      /だれ.*/, /誰.*/, /どちら.*/, /どれ.*/, /いくら.*/, /いくつ.*/,
      /.*ですか/, /.*ますか/, /.*でしょうか/, /.*かしら/, /.*のか/,
      // Polite request endings that imply a question/request
      /.*(教えてください|お聞かせください|お願いします|お願いできますか|お願いしてもいいですか|いただけますか|頂けますか|いただけませんか|てもらえますか|てくれますか|てください)[。?？]?$/
    ];
    
    return questionPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Split a transcription into individual question-like parts.
   */
  private splitIntoQuestions(text: string): string[] {
    if (!text) return [];

    // First, split by strong sentence delimiters
    let parts = text
      .split(/[\n]+|[！？!。]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Further split by question marks while keeping content
    const refinedParts: string[] = [];
    for (const part of parts) {
      const qmSplit = part.split(/[？?]/).map(p => p.trim()).filter(Boolean);
      if (qmSplit.length > 1) {
        refinedParts.push(...qmSplit);
      } else {
        refinedParts.push(part);
      }
    }

    // If still long and contains connectors suggesting multiple items, split on them
    const connectors = ['それから', 'あと', '次に', 'つぎに'];
    const finalParts: string[] = [];
    for (const p of refinedParts) {
      let subParts: string[] = [p];
      for (const c of connectors) {
        subParts = subParts.flatMap(sp => sp.split(c).map(s => s.trim()).filter(Boolean));
      }
      finalParts.push(...subParts);
    }

    // Filter to parts that look like questions or end with question-ish endings
    return finalParts
      .map(p => p.replace(/[、\s]+$/g, '').trim())
      .filter(p => p.length >= 2 && (this.looksLikeQuestion(p) || /[?？]$/.test(p) || /(ですか|ますか|でしょうか|か)$/.test(p) || /(教えてください|お聞かせください|お願いします|お願いできますか|いただけますか|頂けますか|いただけませんか|てもらえますか|てくれますか|てください)$/.test(p)));
  }

  /**
   * Remove unrelated preface before the core question. Heuristic: cut from
   * the earliest occurrence of a question starter or polite-request marker.
   */
  private trimPreface(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    // Do NOT cut when sentence structure contains "について" before the question part
    // Example: "Aについてどう思いますか？" -> keep the leading topic
    const keepTopicPatterns = [/について.*(ですか|ますか|でしょうか|か|[?？]$)/];
    if (keepTopicPatterns.some(p => p.test(trimmed))) {
      return trimmed;
    }

    // Remove only leading filler/preamble tokens at the start (anchored)
    const leadingPrefacePattern = /^(じゃあ|では|それでは|さて|ちなみに|ところで|えっと|えと|あの|その|とりあえず|まぁ|まぁその|なんていうか|まず|えー|あー|うー|そのー|えーっと)\s+/;
    let result = trimmed;
    // Remove repeatedly in case of stacked fillers
    for (let i = 0; i < 3; i++) {
      if (leadingPrefacePattern.test(result)) {
        result = result.replace(leadingPrefacePattern, '').trim();
      } else {
        break;
      }
    }
    return result;
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
    this.emit('state-changed', { ...this.state });
  }

  /**
   * NEW: Quick heuristic to detect recent question activity patterns
   */
  private hasRecentQuestionActivity(): boolean {
    const now = Date.now();
    
    // Check if we've had recent question hints within last 3 seconds
    if (now - this.lastQuestionHintTime < 3000) {
      return true;
    }
    
    // Quick pattern matching on recent audio buffer for question indicators
    const recentText = this.recentAudioBuffer.join(' ').toLowerCase();
    
    // Japanese question patterns that suggest a question is being formed
    const quickQuestionPatterns = [
      'どう', 'どの', 'どこ', 'いつ', 'なぜ', 'なん', '何', 'だれ', '誰',
      'ですか', 'ますか', 'でしょうか', 'か？', 'か。'
    ];
    
    const hasQuestionPattern = quickQuestionPatterns.some(pattern => 
      recentText.includes(pattern)
    );
    
    if (hasQuestionPattern) {
      this.lastQuestionHintTime = now;
      console.log('[AudioStreamProcessor] Question hint detected in recent audio:', recentText.substring(0, 50));
    }
    
    return hasQuestionPattern;
  }

  /**
   * NEW: Real-time streaming question detection during transcription
   */
  private performStreamingQuestionDetection(newText: string): void {
    const now = Date.now();
    
    // Add new text to streaming buffer
    this.streamingBuffer += ' ' + newText;
    
    // Limit buffer size to prevent memory bloat (keep last 500 chars)
    if (this.streamingBuffer.length > 500) {
      this.streamingBuffer = this.streamingBuffer.slice(-500);
    }
    
    // Only check every 500ms to avoid excessive processing
    if (now - this.lastStreamingCheck < 500) {
      return;
    }
    
    this.lastStreamingCheck = now;
    
    // Quick streaming question detection using lightweight patterns
    const streamingText = this.streamingBuffer.toLowerCase().trim();
    
    // Ultra-fast Japanese question pattern matching
    const streamingQuestionPatterns = [
      /どう[です|でしょう|思い|考え].*[か？]/,
      /何[が|を|で|に].*[か？]/,
      /いつ.*[か？]/,
      /どこ.*[か？]/,
      /だれ.*[か？]/,
      /なぜ.*[か？]/,
      /[です|ます]か[？。]/,
      /でしょうか[？。]/
    ];
    
    const hasStreamingQuestion = streamingQuestionPatterns.some(pattern => 
      pattern.test(streamingText)
    );
    
    if (hasStreamingQuestion) {
      console.log('[AudioStreamProcessor] STREAMING question pattern detected:', streamingText.substring(0, 100));
      
      // Trigger immediate chunk processing if we detect a question pattern
      if (this.currentAudioData.length > 0) {
        console.log('[AudioStreamProcessor] Triggering immediate chunk processing due to streaming question detection');
        this.createAndProcessChunk().catch(error => {
          console.error('[AudioStreamProcessor] Error in streaming-triggered chunk processing:', error);
        });
      }
      
      // Clear buffer after detection to avoid re-triggering
      this.streamingBuffer = '';
    }
  }

  /**
   * NEW: Update recent audio buffer for question hint detection
   */
  private updateRecentAudioBuffer(text: string): void {
    if (!text || text.trim().length === 0) return;
    
    this.recentAudioBuffer.push(text.toLowerCase());
    
    // Keep only last 10 entries to avoid memory bloat
    if (this.recentAudioBuffer.length > 10) {
      this.recentAudioBuffer.shift();
    }
  }

  /**
   * Helper methods for audio processing
   */
  private calculateDuration(sampleCount: number): number {
    return (sampleCount / this.config.sampleRate) * 1000;
  }

  private async createTempAudioFile(buffer: Buffer): Promise<string> {
    const tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);
    
    // WAV file parameters
    const sampleRate = this.config.sampleRate;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length;
    const fileSize = 36 + dataSize;
    
    // Create WAV header (44 bytes total)
    const header = Buffer.alloc(44);
    let offset = 0;
    
    // RIFF Header
    header.write('RIFF', offset); offset += 4;
    header.writeUInt32LE(fileSize, offset); offset += 4;
    header.write('WAVE', offset); offset += 4;
    
    // Format Chunk
    header.write('fmt ', offset); offset += 4;
    header.writeUInt32LE(16, offset); offset += 4;
    header.writeUInt16LE(1, offset); offset += 2;
    header.writeUInt16LE(channels, offset); offset += 2;
    header.writeUInt32LE(sampleRate, offset); offset += 4;
    header.writeUInt32LE(byteRate, offset); offset += 4;
    header.writeUInt16LE(blockAlign, offset); offset += 2;
    header.writeUInt16LE(bitsPerSample, offset); offset += 2;
    
    // Data Chunk Header
    header.write('data', offset); offset += 4;
    header.writeUInt32LE(dataSize, offset);
    
    // Combine header and PCM data
    const wavFile = Buffer.concat([header, buffer]);
    
    await fs.promises.writeFile(tempPath, wavFile);
    return tempPath;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.warn('[AudioStreamProcessor] Failed to cleanup temp file:', filePath);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.removeAllListeners();
    this.currentAudioData = [];
    this.state.questionBuffer = [];
  }
}