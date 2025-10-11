/**
 * Handles real-time streaming question detection
 * Phase 2A Optimization: Aggressive pattern matching for 100-200ms faster detection
 */
export class StreamingQuestionDetector {
  private streamingBuffer: string = '';
  private lastStreamingCheck: number = 0;
  private recentAudioBuffer: string[] = [];
  private lastQuestionHintTime: number = 0;

  // Precompiled regex patterns for maximum performance
  private static readonly STREAMING_PATTERNS = [
    // Japanese question starters (expanded)
    /どう[です|でしょう|思い|考え|やって|すれば|なって|いう]/,
    /何[が|を|で|に|の|から|まで|という|について]/,
    /いつ[から|まで|頃|ごろ|の|に|は|も]/,
    /どこ[で|に|から|まで|の|へ|が]/,
    /だれ[が|を|に|の|と|から]/,
    /誰[が|を|に|の|と|から]/,
    /なぜ[なら|か|です|でしょう]/,
    /どちら[が|を|に|の|へ|から]/,
    /どれ[が|を|に|の|ほど|くらい]/,
    /いくら[で|です|か|くらい]/,
    /いくつ[か|の|ある|です]/,
    /どんな[もの|こと|感じ|風|人]/,
    
    // Question endings (expanded)
    /[です|ます]か[？。\s]/,
    /でしょうか[？。\s]/,
    /ませんか[？。\s]/,
    /ますか[？。\s]/,
    /ですか[？。\s]/,
    /かしら[？。\s]/,
    /のか[？。\s]/,
    /んですか[？。\s]/,
    /んでしょうか[？。\s]/,
    
    // Polite request patterns (often questions)
    /教えて[ください|くれ|もらえ|いただけ]/,
    /お聞かせ[ください|いただけ]/,
    /お願い[します|できます|してもいい]/,
    /いただけ[ます|ません]か/,
    /もらえ[ます|ません]か/,
    /くれ[ます|ません]か/,
    
    // English question patterns (for mixed language)
    /\b(what|how|why|when|where|who|which|can|could|should|would|will|is|are|do|does|did)\b/i
  ];

  constructor() {
  }

  /**
   * Quick heuristic to detect recent question activity patterns
   * Phase 2A: Expanded patterns for earlier detection
   */
  public hasRecentQuestionActivity(): boolean {
    const now = Date.now();
    
    // Check if we've had recent question hints within last 2.5 seconds (reduced from 3s)
    if (now - this.lastQuestionHintTime < 2500) {
      return true;
    }
    
    // Quick pattern matching on recent audio buffer for question indicators
    const recentText = this.recentAudioBuffer.join(' ').toLowerCase();
    
    // Expanded Japanese question patterns for earlier detection
    const quickQuestionPatterns = [
      // Question starters
      'どう', 'どの', 'どこ', 'いつ', 'なぜ', 'なん', '何', 'だれ', '誰',
      'どちら', 'どれ', 'いくら', 'いくつ', 'どんな',
      
      // Question endings
      'ですか', 'ますか', 'でしょうか', 'ませんか', 'か？', 'か。',
      'かしら', 'のか', 'んですか', 'んでしょうか',
      
      // Polite requests (often questions)
      '教えて', 'お聞かせ', 'お願い', 'いただけ', 'もらえ', 'くれ',
      
      // English question words
      'what', 'how', 'why', 'when', 'where', 'who', 'which'
    ];
    
    const hasQuestionPattern = quickQuestionPatterns.some(pattern => 
      recentText.includes(pattern)
    );
    
    if (hasQuestionPattern) {
      this.lastQuestionHintTime = now;
    }
    
    return hasQuestionPattern;
  }

  /**
   * Real-time streaming question detection during transcription
   * Phase 2A: Reduced check interval from 500ms to 200ms for faster detection
   */
  public checkForStreamingQuestion(newText: string): boolean {
    const now = Date.now();
    
    // Add new text to streaming buffer
    this.streamingBuffer += ' ' + newText;
    
    // Limit buffer size to prevent memory bloat (keep last 500 chars)
    if (this.streamingBuffer.length > 500) {
      this.streamingBuffer = this.streamingBuffer.slice(-500);
    }
    
    // Phase 2A: Check every 200ms instead of 500ms for faster detection
    if (now - this.lastStreamingCheck < 200) {
      return false;
    }
    
    this.lastStreamingCheck = now;
    
    // Quick streaming question detection using precompiled patterns
    const streamingText = this.streamingBuffer.toLowerCase().trim();
    
    // Use precompiled patterns for maximum performance
    const hasStreamingQuestion = StreamingQuestionDetector.STREAMING_PATTERNS.some(pattern => 
      pattern.test(streamingText)
    );
    
    if (hasStreamingQuestion) {
      // Clear buffer after detection to avoid re-triggering
      this.streamingBuffer = '';
      return true;
    }
    
    return false;
  }

  /**
   * Update recent audio buffer for question hint detection
   * Phase 2A: Increased buffer size for better context
   */
  public updateRecentAudioBuffer(text: string): void {
    if (!text || text.trim().length === 0) return;
    
    this.recentAudioBuffer.push(text.toLowerCase());
    
    // Phase 2A: Keep last 15 entries (increased from 10) for better pattern detection
    if (this.recentAudioBuffer.length > 15) {
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
