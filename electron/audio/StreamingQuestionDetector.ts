/**
 * Handles real-time streaming question detection
 */
export class StreamingQuestionDetector {
  private streamingBuffer: string = '';
  private lastStreamingCheck: number = 0;
  private recentAudioBuffer: string[] = [];
  private lastQuestionHintTime: number = 0;

  constructor() {
    console.log('[StreamingQuestionDetector] Initialized');
  }

  /**
   * Quick heuristic to detect recent question activity patterns
   */
  public hasRecentQuestionActivity(): boolean {
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
      console.log('[StreamingQuestionDetector] Question hint detected in recent audio:', recentText.substring(0, 50));
    }
    
    return hasQuestionPattern;
  }

  /**
   * Real-time streaming question detection during transcription
   */
  public checkForStreamingQuestion(newText: string): boolean {
    const now = Date.now();
    
    // Add new text to streaming buffer
    this.streamingBuffer += ' ' + newText;
    
    // Limit buffer size to prevent memory bloat (keep last 500 chars)
    if (this.streamingBuffer.length > 500) {
      this.streamingBuffer = this.streamingBuffer.slice(-500);
    }
    
    // Only check every 500ms to avoid excessive processing
    if (now - this.lastStreamingCheck < 500) {
      return false;
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
      console.log('[StreamingQuestionDetector] STREAMING question pattern detected:', streamingText.substring(0, 100));
      
      // Clear buffer after detection to avoid re-triggering
      this.streamingBuffer = '';
      return true;
    }
    
    return false;
  }

  /**
   * Update recent audio buffer for question hint detection
   */
  public updateRecentAudioBuffer(text: string): void {
    if (!text || text.trim().length === 0) return;
    
    this.recentAudioBuffer.push(text.toLowerCase());
    
    // Keep only last 10 entries to avoid memory bloat
    if (this.recentAudioBuffer.length > 10) {
      this.recentAudioBuffer.shift();
    }
  }

  /**
   * Clear all buffers
   */
  public clear(): void {
    this.streamingBuffer = '';
    this.recentAudioBuffer = [];
    this.lastQuestionHintTime = 0;
    this.lastStreamingCheck = 0;
  }
}
