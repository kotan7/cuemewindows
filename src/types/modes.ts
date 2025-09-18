// モード機能の型定義
export interface ModeConfig {
  key: string
  displayName: string
  tone: ToneType
  formality: FormalityType
  length: LengthType
  sentence_max: number
  bullets_max: number
  paragraphs_max: number
  examples_max: number
  code_ok: boolean
  rationale: RationaleType
  structure: StructureType[]
  rules_plus: string[]
  rules_minus: string[]
}

export type ToneType = 
  | 'neutral' 
  | 'friendly' 
  | 'polite' 
  | 'assertive' 
  | 'sales' 
  | 'teacher' 
  | 'support'

export type FormalityType = 
  | 'casual' 
  | 'desu_masu' 
  | 'keigo'

export type LengthType = 
  | 'one_liner' 
  | 'short' 
  | 'standard' 
  | 'detailed' 
  | 'step_by_step'

export type RationaleType = 
  | 'hidden' 
  | 'inline' 
  | 'solutions_only'

export type StructureType = 
  | 'conclusion_first'
  | 'steps'
  | 'prep' // Point→Reason→Example→Point
  | 'care_mark' // リスク/注意は "⚠" を付けて短文
  | 'claim'
  | 'evidence'
  | 'counterarguments'
  | 'rebuttal'
  | 'concept'
  | 'example'
  | 'exercise'
  | 'solution_key_points'
  | 'opener'
  | 'hook_question'
  | 'value_15s'
  | 'cta'
  | 'empathy'
  | 'diagnosis'
  | 'fallback'
  | 'followup'

// JSON応答形式の型定義
export interface ModeResponse {
  answer: string
  bullets: string[]
  next_actions: string[]
  followup_questions: string[]
  style_meta: {
    tone: ToneType
    formality: FormalityType
    length: LengthType
    sentence_max: number
  }
  safety_notes: string[]
  citations: string[]
}

// レガシー応答との互換性
export interface CompatibleResponse {
  text?: string // 従来のレスポンス
  modeResponse?: ModeResponse // 新しいモードレスポンス
  timestamp: number
  ragContext?: any
}

// モード選択のUI用
export interface ModeOption {
  key: string
  displayName: string
  description: string
  icon?: string
}

export interface ModeContext {
  currentMode: string
  availableModes: ModeOption[]
  isEnabled: boolean
}