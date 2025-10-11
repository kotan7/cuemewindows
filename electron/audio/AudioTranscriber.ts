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
  }

  /**
   * Transcribe audio chunk using OpenAI Whisper
   */
  public async transcribe(chunk: AudioChunk): Promise<TranscriptionResult> {
    try {
      // Check if audio has sufficient volume (not just silence/background noise)
      const hasSignificantAudio = this.hasSignificantAudio(chunk.data);
      
      if (!hasSignificantAudio) {
        // Return empty result for silent/low-volume audio
        return {
          id: uuidv4(),
          text: "",
          timestamp: chunk.timestamp,
          confidence: 0.0,
          isQuestion: false,
          originalChunkId: chunk.id
        };
      }

      // Convert to PCM buffer for Whisper API
      const pcmBuffer = this.convertToPCM(chunk.data);
      const tempFilePath = await this.createTempAudioFile(pcmBuffer);
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "ja",
        response_format: "json",
        temperature: 0.2
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
   * Check if audio chunk has significant audio content (not just silence/noise)
   */
  private hasSignificantAudio(audioData: Float32Array): boolean {
    // Calculate RMS (Root Mean Square) to measure audio energy
    let sumSquares = 0;
    for (let i = 0; i < audioData.length; i++) {
      sumSquares += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sumSquares / audioData.length);
    
    // Threshold for significant audio (adjust based on testing)
    // 0.01 = 1% of max volume - filters out very quiet background noise
    const SIGNIFICANT_AUDIO_THRESHOLD = 0.01;
    
    return rms > SIGNIFICANT_AUDIO_THRESHOLD;
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
      // Silent cleanup failure
    }
  }
}
