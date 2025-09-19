// ModeManagerクラス - モード設定を直接埋め込み版
import { ModeConfig, ModeResponse, StructureType } from '../src/types/modes'

export class ModeManager {
  private modes: Map<string, ModeConfig> = new Map()
  private systemPromptTemplate: string
  private structureMacros: Map<StructureType, string> = new Map()

  constructor() {
    this.systemPromptTemplate = this.initializeSystemPromptTemplate()
    this.initializeStructureMacros()
    this.loadModes()
  }

  private initializeSystemPromptTemplate(): string {
    return `あなたは CueMe の応答エンジン。下記パラメータに厳密に従って出力を生成する。

[STYLE_KNOBS]
- tone: {tone}               # 例: neutral | friendly | polite | assertive | sales | teacher | support
- formality: {formality}     # 例: casual | desu_masu | keigo
- length: {length}           # 例: one_liner | short | standard | detailed | step_by_step
- sentence_max: {sentence_max}   # 1文の最大文長(日本語は読点区切りを意識)。目安: 20〜30語
- bullets_max: {bullets_max}     # 箇条書き最大数
- paragraphs_max: {paragraphs_max} # 段落最大数
- examples_max: {examples_max}   # 例示の最大数
- code_ok: {code_ok}             # true/false
- show_rationale: {rationale}    # hidden | inline | solutions_only

[OUTPUT SHAPE]
必ず次のJSONで返す（キー順を守る）:
{
  "answer": "<本文（ユーザーが直で見る）>",
  "bullets": ["<必要なら箇条書き>"],
  "next_actions": ["<次の一歩>"],
  "followup_questions": ["<確認/逆質問>"],
  "style_meta": {
    "tone": "{tone}",
    "formality": "{formality}",
    "length": "{length}",
    "sentence_max": {sentence_max}
  },
  "safety_notes": ["<留意点（表示不要なら空配列で可）>"],
  "citations": ["<RAGの参照ID。なければ空配列>"]
}

[HARD RULES]
- 文字数・文数の超過を避ける。超えそうなら要約して削る。
- 日本語の敬語レベルは formality に従う（casual/ですます/敬語）。
- 禁則語や誇大表現は各モードの規約に従って抑制。
- 思考過程は show_rationale に従い出力（hidden の場合は出さない）。

[STRUCTURE MACROS]
{structure_macros}

[MODE SPECIFIC RULES]
DO（推奨）:
{rules_plus}

DON'T（禁止）:
{rules_minus}

JSONオブジェクトのみを返し、マークダウン形式やコードブロックは使用しないでください。`
  }

  private initializeStructureMacros(): void {
    this.structureMacros.set('conclusion_first', '結論を最初の1-2文で提示。')
    this.structureMacros.set('steps', '手順を番号付きで簡潔に。')
    this.structureMacros.set('prep', 'Point→Reason→Example→Pointの順で。')
    this.structureMacros.set('care_mark', 'リスク/注意は "⚠" を付けて短文で。')
    this.structureMacros.set('claim', '主張を明確に提示。')
    this.structureMacros.set('evidence', '検証可能な根拠を示す。')
    this.structureMacros.set('counterarguments', '反論想定と対応。')
    this.structureMacros.set('rebuttal', '再反論で主張を強化。')
    this.structureMacros.set('concept', '概念の定義と説明。')
    this.structureMacros.set('example', '具体例による理解促進。')
    this.structureMacros.set('exercise', '練習問題やチャレンジ。')
    this.structureMacros.set('solution_key_points', '解答のポイント整理。')
    this.structureMacros.set('opener', '導入とアイスブレイク。')
    this.structureMacros.set('hook_question', '興味を引く質問。')
    this.structureMacros.set('value_15s', '15秒で価値提案。')
    this.structureMacros.set('cta', '明確な行動促進。')
    this.structureMacros.set('empathy', '共感と理解の表現。')
    this.structureMacros.set('diagnosis', '問題の分析と特定。')
    this.structureMacros.set('fallback', '代替案の提示。')
    this.structureMacros.set('followup', 'フォローアップの提案。')
  }

  private loadModes(): void {
    // モード設定を直接定義（ファイル読み込みを避ける）
    const modesData: ModeConfig[] = [
      {
        key: "interview",
        displayName: "面接モード（候補者）",
        tone: "assertive",
        formality: "desu_masu",
        length: "short",
        sentence_max: 26,
        bullets_max: 3,
        paragraphs_max: 2,
        examples_max: 1,
        code_ok: false,
        rationale: "solutions_only",
        structure: ["conclusion_first", "steps"],
        rules_plus: [
          "60〜120秒で話せる量に圧縮",
          "Big-Oは1行で",
          "擬似コードなら最小限"
        ],
        rules_minus: [
          "冗長な前置きNG",
          "自信なさげな表現NG（多分/かもしれない を避ける）"
        ]
      },
      {
        key: "meeting",
        displayName: "会議モード",
        tone: "neutral",
        formality: "desu_masu",
        length: "standard",
        sentence_max: 28,
        bullets_max: 7,
        paragraphs_max: 4,
        examples_max: 2,
        code_ok: false,
        rationale: "solutions_only",
        structure: ["conclusion_first", "steps"],
        rules_plus: ["TL;DR→議題→決定→保留→ToDo(owner, due)"],
        rules_minus: ["主観の断定NG", "不確実は『仮説』と明示"]
      },
      {
        key: "sales",
        displayName: "商談モード（提案）",
        tone: "sales",
        formality: "keigo",
        length: "standard",
        sentence_max: 24,
        bullets_max: 5,
        paragraphs_max: 4,
        examples_max: 2,
        code_ok: false,
        rationale: "hidden",
        structure: ["prep", "steps"],
        rules_plus: ["Pain→Value→Proof→Next", "実数値か事例を1つ以上"],
        rules_minus: ["誇大表現NG", "根拠なき比較NG"]
      },
      {
        key: "support",
        displayName: "サポート",
        tone: "support",
        formality: "keigo",
        length: "standard",
        sentence_max: 24,
        bullets_max: 7,
        paragraphs_max: 5,
        examples_max: 1,
        code_ok: true,
        rationale: "hidden",
        structure: ["empathy", "diagnosis", "steps", "fallback", "followup"],
        rules_plus: ["番号付き手順", "危険操作は⚠で注意喚起"],
        rules_minus: ["お客さまの責任示唆NG"]
      }
    ]

    modesData.forEach(mode => {
      this.modes.set(mode.key, mode)
    })

    console.log(`[ModeManager] Loaded ${this.modes.size} modes`)
  }

  public buildSystemPrompt(modeKey: string): string {
    const mode = this.modes.get(modeKey)
    if (!mode) {
      console.warn(`[ModeManager] Mode '${modeKey}' not found, using default`)
      return this.buildSystemPrompt('interview')
    }

    // 構造マクロの文字列を生成
    const structureMacrosText = mode.structure
      .map(macro => `- ${macro}: ${this.structureMacros.get(macro) || ''}`)
      .join('\n')

    // rules_plusとrules_minusの文字列を生成
    const rulesPlusText = mode.rules_plus.map(rule => `- ${rule}`).join('\n')
    const rulesMinusText = mode.rules_minus.map(rule => `- ${rule}`).join('\n')

    // テンプレートの置換
    return this.systemPromptTemplate
      .replace(/\{tone\}/g, mode.tone)
      .replace(/\{formality\}/g, mode.formality)
      .replace(/\{length\}/g, mode.length)
      .replace(/\{sentence_max\}/g, mode.sentence_max.toString())
      .replace(/\{bullets_max\}/g, mode.bullets_max.toString())
      .replace(/\{paragraphs_max\}/g, mode.paragraphs_max.toString())
      .replace(/\{examples_max\}/g, mode.examples_max.toString())
      .replace(/\{code_ok\}/g, mode.code_ok.toString())
      .replace(/\{rationale\}/g, mode.rationale)
      .replace(/\{structure_macros\}/g, structureMacrosText)
      .replace(/\{rules_plus\}/g, rulesPlusText)
      .replace(/\{rules_minus\}/g, rulesMinusText)
  }

  public getModeConfig(modeKey: string): ModeConfig | undefined {
    return this.modes.get(modeKey)
  }

  public getAllModes(): ModeConfig[] {
    return Array.from(this.modes.values())
  }

  public getModeOptions() {
    return this.getAllModes().map(mode => ({
      key: mode.key,
      displayName: mode.displayName,
      description: this.getModeDescription(mode)
    }))
  }

  private getModeDescription(mode: ModeConfig): string {
    const toneDesc = this.getToneDescription(mode.tone)
    const lengthDesc = this.getLengthDescription(mode.length)
    const formalityDesc = this.getFormalityDescription(mode.formality)

    return `${toneDesc}、${lengthDesc}、${formalityDesc}`
  }

  private getToneDescription(tone: string): string {
    const descriptions = {
      'neutral': '中立的',
      'friendly': 'フレンドリー',
      'polite': '丁寧',
      'assertive': '積極的',
      'sales': '営業的',
      'teacher': '教育的',
      'support': 'サポート的'
    }
    return descriptions[tone as keyof typeof descriptions] || tone
  }

  private getLengthDescription(length: string): string {
    const descriptions = {
      'one_liner': '一言',
      'short': '短め',
      'standard': '標準',
      'detailed': '詳細',
      'step_by_step': 'ステップ形式'
    }
    return descriptions[length as keyof typeof descriptions] || length
  }

  private getFormalityDescription(formality: string): string {
    const descriptions = {
      'casual': 'カジュアル',
      'desu_masu': 'ですます調',
      'keigo': '敬語'
    }
    return descriptions[formality as keyof typeof descriptions] || formality
  }

  public parseResponse(responseText: string): ModeResponse | null {
    try {
      // JSONマークダウンブロックを除去
      const cleanedText = responseText
        .replace(/^```(?:json)?\n/, '')
        .replace(/\n```$/, '')
        .trim()

      const parsed = JSON.parse(cleanedText)

      // 必須フィールドの検証
      if (!parsed.answer || !parsed.style_meta) {
        console.warn('[ModeManager] Invalid response format')
        return null
      }

      return parsed as ModeResponse
    } catch (error) {
      console.error('[ModeManager] Error parsing response:', error)
      return null
    }
  }

  public createCompatibleResponse(
    text: string,
    modeResponse: ModeResponse | null,
    ragContext?: any
  ) {
    return {
      text: modeResponse?.answer || text,
      modeResponse,
      timestamp: Date.now(),
      ragContext
    }
  }
}