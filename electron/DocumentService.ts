import { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

export interface Document {
  id: string
  display_name: string
  file_name: string
  chunk_count: number
  created_at: string
  status: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_text: string
  chunk_order: number
  created_at: string
}

export interface DocumentSearchResult {
  id: string
  document_id: string
  chunk_text: string
  chunk_order: number
  similarity: number
  document_name?: string
}

export class DocumentService {
  private supabase: SupabaseClient
  private openai: OpenAI
  private openaiApiKey: string | undefined

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient
    
    // Initialize OpenAI client
    this.openaiApiKey = process.env.OPENAI_API_KEY
    
    if (!this.openaiApiKey) {
      console.error('[DocumentService] Missing OpenAI configuration. Please set OPENAI_API_KEY environment variable.')
      console.warn('[DocumentService] Document search functionality will not work until proper OpenAI credentials are provided.')
    }
    
    this.openai = new OpenAI({
      apiKey: this.openaiApiKey || 'placeholder-key',
    })
  }

  private normalizeJapaneseText(text: string): string {
    return text
      // Normalize full-width to half-width numbers
      .replace(/[０-９]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xFEE0))
      // Normalize full-width to half-width ASCII
      .replace(/[Ａ-Ｚａ-ｚ]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xFEE0))
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .trim()
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not configured in DocumentService')
      }
      
      // Normalize Japanese text for better embedding quality (same as web version)
      const normalizedText = this.normalizeJapaneseText(text)
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: normalizedText.replace(/\n/g, ' '),
        dimensions: 1536
      })
      
      return response.data[0].embedding
    } catch (error) {
      console.error('[DocumentService] Error generating embedding:', error)
      throw new Error(`Failed to generate embedding: ${error.message}`)
    }
  }

  public async getUserDocuments(userId: string): Promise<Document[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('id, display_name, file_name, chunk_count, created_at, status')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching user documents:', error)
      throw error
    }
  }

  public async getDocument(documentId: string): Promise<Document | null> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('id, display_name, file_name, chunk_count, created_at, status')
        .eq('id', documentId)
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error fetching document:', error)
      return null
    }
  }

  public async searchDocumentChunks(
    query: string,
    documentId: string,
    matchThreshold: number = 0.7,
    matchCount: number = 5
  ): Promise<DocumentSearchResult[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(query)
      
      // Use the Postgres function for vector similarity search
      const { data, error } = await this.supabase.rpc('search_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        user_id_filter: null, // We'll filter by document_id instead
        document_id_filter: documentId
      })

      if (error) {
        console.error('[DocumentService] Supabase RPC error:', error)
        throw error
      }

      // Get document name for context
      const document = await this.getDocument(documentId)
      const documentName = document?.display_name || document?.file_name

      const results = (data || []).map((chunk: any) => ({
        ...chunk,
        document_name: documentName
      }))
      
      console.log(`[DocumentService] Document search found ${results.length} chunks for query: "${query.substring(0, 50)}..."`)

      return results
    } catch (error) {
      console.error('[DocumentService] Error searching document chunks:', error)
      throw error
    }
  }

  public async findRelevantChunks(
    question: string,
    documentId: string,
    threshold: number = 0.7
  ): Promise<{
    hasRelevantChunks: boolean
    chunks: DocumentSearchResult[]
    bestMatch?: DocumentSearchResult
  }> {
    try {
      const results = await this.searchDocumentChunks(question, documentId, threshold, 3)
      
      const hasRelevantChunks = results.length > 0
      const bestMatch = results.length > 0 ? results[0] : undefined
      
      return {
        hasRelevantChunks,
        chunks: results,
        bestMatch
      }
    } catch (error) {
      console.error('[DocumentService] Error finding relevant chunks:', error)
      return {
        hasRelevantChunks: false,
        chunks: []
      }
    }
  }

  public formatRAGContext(results: DocumentSearchResult[]): string {
    if (results.length === 0) return ''
    
    const context = results
      .map((result, index) => {
        return `Context ${index + 1} (similarity: ${result.similarity.toFixed(2)}) from ${result.document_name}:\n${result.chunk_text}`
      })
      .join('\n\n---\n\n')
      
    return `Based on the following relevant information from your documents:\n\n${context}\n\nPlease provide a comprehensive answer:`
  }

  // Test method to verify embedding generation works
  public async testEmbeddingGeneration(): Promise<boolean> {
    try {
      const testText = "This is a test text for embedding generation"
      const embedding = await this.generateEmbedding(testText)
      console.log('[DocumentService] Embedding test successful, dimension:', embedding.length)
      return true
    } catch (error) {
      console.error('[DocumentService] Embedding test failed:', error)
      return false
    }
  }
}