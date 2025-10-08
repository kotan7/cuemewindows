import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { AudioChunk, TranscriptionResult } from "../../src/types/audio-stream";
import { v4 as uuidv4 } from "uuid";

/**
 * Handles audio transcription using OpenAI Whisper API
 */
export class AudioTranscriber {
  private openai: OpenAI;
  private sampleRate: number;

  constructor(openaiApiKey: string, sampleRate: number = 16000) {
    if (!openaiApiKey || openaiApiKey.trim() === '') {
      throw new Error('OpenAI API key is required for AudioTranscriber');
    }
    
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.sampleRate = sampleRate;
    
    console.log('[AudioTranscriber] Initialized with sample rate:', sampleRate);
  }

  /**
   * Transcribe audio chunk using OpenAI Whisper
   */
  public async transcribe(chunk: AudioChunk): Promise<TranscriptionResult> {
    console.log('[AudioTranscriber] Starting transcription for chunk:', {
      id: chunk.id,
      duration: chunk.duration,
      dataLength: chunk.data.length,
      timestamp: chunk.timestamp
    });

    try {
      // Convert to PCM buffer for Whisper API
      const pcmBuffer = this.convertToPCM(chunk.data);
      console.log('[AudioTranscriber] Created PCM buffer, size:', pcmBuffer.length);
      
      const tempFilePath = await this.createTempAudioFile(pcmBuffer);
      console.log('[AudioTranscriber] Created WAV file:', tempFilePath);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "ja",
        response_format: "json",
        temperature: 0.2
      });
      
      console.log('[AudioTranscriber] Whisper transcription result:', {
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

      return result;
      
    } catch (error) {
      console.error('[AudioTranscriber] Transcription error:', error);
      throw error;
    }
  }

  /**
   * Convert Float32Array to PCM buffer
   */
  private convertToPCM(audioData: Float32Array): Buffer {
    const pcmBuffer = Buffer.alloc(audioData.length * 2);
    for (let i = 0; i < audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      const value = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
      pcmBuffer.writeInt16LE(value, i * 2);
    }
    return pcmBuffer;
  }

  /**
   * Create temporary WAV file for Whisper API
   */
  private async createTempAudioFile(buffer: Buffer): Promise<string> {
    const tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.wav`);
    
    // WAV file parameters
    const sampleRate = this.sampleRate;
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

  /**
   * Clean up temporary audio file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      console.warn('[AudioTranscriber] Failed to cleanup temp file:', filePath);
    }
  }
}
