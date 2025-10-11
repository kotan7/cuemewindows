import { DetectedQuestion, TranscriptionResult } from "../../src/types/audio-stream";
import { QuestionDetector } from "../QuestionDetector";
import { v4 as uuidv4 } from "uuid";

/**
 * Handles question detection and refinement
 * Phase 2A: Expanded pattern matching for faster question detection
 */
export class QuestionRefiner {
  private questionDetector: QuestionDetector;
  
  // Japanese filler words and patterns to remove
  private readonly fillerWords = new Set([
    'えー', 'あー', 'うー', 'んー', 'そのー', 'あのー', 'えーっと', 'あーと',
    'まあ', 'なんか', 'ちょっと', 'やっぱり', 'やっぱ', 'だから', 'でも',
    'うん', 'はい', 'そう', 'ですね', 'ですが', 'ただ', 'まず', 'それで',
    'というか', 'てか', 'なので', 'けど', 'けれど', 'しかし', 'でも',
    'ー', '〜', 'う〜ん', 'え〜', 'あ〜', 'そ〜', 'ん〜',
    'じゃあ', 'では', 'それでは', 'さて', 'ちなみに', 'ところで', 'えっと', 'えと',
    'あの', 'その', 'とりあえず', 'まぁ', 'まぁその', 'なんていうか'
  ]);

  // Phase 2A: Expanded question starters for better detection
  private readonly questionStarters = new Set([
    'どう', 'どの', 'どこ', 'いつ', 'なぜ', 'なん', '何', 'だれ', '誰',
    'どちら', 'どれ', 'いくら', 'いくつ', 'どのよう', 'どんな',
    // Additional starters
    'どうして', 'どうやって', 'どういう', 'どうすれば', 'どうなる',
    'なにが', 'なにを', 'なにで', 'なにに', 'なにから',
    'いつから', 'いつまで', 'いつごろ', 'いつ頃',
    'どこで', 'どこに', 'どこから', 'どこまで',
    'だれが', 'だれを', 'だれに', 'だれと',
    '誰が', '誰を', '誰に', '誰と'
  ]);

  constructor() {
    this.questionDetector = new QuestionDetector();
  }

  /**
   * Detect questions and immediately refine them algorithmically
   */
  public detectAndRefineQuestions(transcription: TranscriptionResult): DetectedQuestion[] {
    try {
      // Skip empty or very short transcriptions
      if (!transcription.text || transcription.text.trim().length < 3) {
        return [];
      }

      const detectedQuestion = this.questionDetector.detectQuestion(transcription);
      const baseText = detectedQuestion ? detectedQuestion.text : transcription.text;

      // Split possible multiple questions, trim preface, and refine each
      const questionParts = this.splitIntoQuestions(baseText);

      if (questionParts.length === 0) {
        return [];
      }

      // Process each question part synchronously (no async overhead)
      const allQuestions: DetectedQuestion[] = [];
      
      for (const part of questionParts) {
        const core = this.trimPreface(part);
        if (!core || core.trim().length < 2) continue;

        const tempQuestion: DetectedQuestion = {
          id: uuidv4(),
          text: core.trim(),
          timestamp: detectedQuestion ? detectedQuestion.timestamp : transcription.timestamp,
          confidence: detectedQuestion ? detectedQuestion.confidence : transcription.confidence
        };

        // Validate by either the detector's rules or our heuristic recognizer
        if (!this.questionDetector.isValidQuestion(tempQuestion) && !this.looksLikeQuestion(core)) {
          continue;
        }

        const refinedText = this.refineQuestionAlgorithmically(core);

        const refinedQuestion: DetectedQuestion & { refinedText?: string } = {
          ...tempQuestion,
          refinedText
        };

        allQuestions.push(refinedQuestion);
      }
      
      return allQuestions;
      
    } catch (error) {
      console.error('[QuestionRefiner] Question detection error:', error);
      throw error;
    }
  }

  /**
   * Algorithmically refine question text by removing fillers and cleaning up
   */
  private refineQuestionAlgorithmically(text: string): string {
    try {
      let refined = text.toLowerCase().trim();
      
      // Step 1: Remove common Japanese filler words
      const words = refined.split(/[\s、。！？]+/).filter(word => word.length > 0);
      const cleanedWords = words.filter(word => !this.fillerWords.has(word));
      
      // Step 2: Remove repetitive patterns
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
      
      // Step 5: Remove trailing particles
      refined = refined.replace(/[、。！？\s]*$/, '');
      refined = refined.replace(/\s*(です|ます|だ|である|でしょう|かな|よね)?\s*$/i, '');
      
      // Step 6: Ensure question ends appropriately
      if (!refined.endsWith('？') && !refined.endsWith('?')) {
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
        return text;
      }
      
      return refined;
      
    } catch (error) {
      console.error('[QuestionRefiner] Error in algorithmic refinement:', error);
      return text;
    }
  }

  /**
   * Check if text structure looks like a question
   * Phase 2A: Expanded patterns for better detection
   */
  private looksLikeQuestion(text: string): boolean {
    const questionPatterns = [
      // Question starters (expanded)
      /どう[して|やって|いう|すれば|なる]?.*/, 
      /どの.*/, /どこ[で|に|から|まで]?.*/, 
      /いつ[から|まで|頃|ごろ]?.*/, 
      /なぜ.*/, /なん.*/, /何[が|を|で|に|の|から]?.*/, 
      /だれ[が|を|に|と]?.*/, /誰[が|を|に|と]?.*/, 
      /どちら.*/, /どれ.*/, /いくら.*/, /いくつ.*/,
      /どんな.*/,
      
      // Question endings (expanded)
      /.*ですか/, /.*ますか/, /.*でしょうか/, /.*ませんか/,
      /.*かしら/, /.*のか/, /.*んですか/, /.*んでしょうか/,
      
      // Polite requests (expanded)
      /.*(教えて[ください|くれ|もらえ|いただけ])/, 
      /.*(お聞かせ[ください|いただけ])/,
      /.*(お願い[します|できます|してもいい])/,
      /.*(いただけ[ます|ません]か)/,
      /.*(もらえ[ます|ません]か)/,
      /.*(くれ[ます|ません]か)/,
      /.*(教えて|お聞かせ|お願い|いただけ|もらえ|くれ)[。?？]?$/,
      
      // English patterns
      /\b(what|how|why|when|where|who|which|can|could|should|would|will)\b/i
    ];
    
    return questionPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Split a transcription into individual question-like parts
   */
  private splitIntoQuestions(text: string): string[] {
    if (!text) return [];

    // Split by strong sentence delimiters
    let parts = text
      .split(/[\n]+|[！？!。]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Further split by question marks
    const refinedParts: string[] = [];
    for (const part of parts) {
      const qmSplit = part.split(/[？?]/).map(p => p.trim()).filter(Boolean);
      if (qmSplit.length > 1) {
        refinedParts.push(...qmSplit);
      } else {
        refinedParts.push(part);
      }
    }

    // Split on connectors if still long
    const connectors = ['それから', 'あと', '次に', 'つぎに'];
    const finalParts: string[] = [];
    for (const p of refinedParts) {
      let subParts: string[] = [p];
      for (const c of connectors) {
        subParts = subParts.flatMap(sp => sp.split(c).map(s => s.trim()).filter(Boolean));
      }
      finalParts.push(...subParts);
    }

    // Filter to parts that look like questions
    return finalParts
      .map(p => p.replace(/[、\s]+$/g, '').trim())
      .filter(p => p.length >= 2 && (this.looksLikeQuestion(p) || /[?？]$/.test(p) || /(ですか|ますか|でしょうか|か)$/.test(p) || /(教えてください|お聞かせください|お願いします|お願いできますか|いただけますか|頂けますか|いただけませんか|てもらえますか|てくれますか|てください)$/.test(p)));
  }

  /**
   * Remove unrelated preface before the core question
   */
  private trimPreface(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;

    // Keep topic patterns like "について"
    const keepTopicPatterns = [/について.*(ですか|ますか|でしょうか|か|[?？]$)/];
    if (keepTopicPatterns.some(p => p.test(trimmed))) {
      return trimmed;
    }

    // Remove leading filler/preamble tokens
    const leadingPrefacePattern = /^(じゃあ|では|それでは|さて|ちなみに|ところで|えっと|えと|あの|その|とりあえず|まぁ|まぁその|なんていうか|まず|えー|あー|うー|そのー|えーっと)\s+/;
    let result = trimmed;
    for (let i = 0; i < 3; i++) {
      if (leadingPrefacePattern.test(result)) {
        result = result.replace(leadingPrefacePattern, '').trim();
      } else {
        break;
      }
    }
    return result;
  }
}
