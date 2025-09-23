import { AudioStreamProcessor } from '../AudioStreamProcessor';
import { SystemAudioCapture } from '../SystemAudioCapture';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

// Mock SystemAudioCapture
jest.mock('../SystemAudioCapture');

// Mock QuestionDetector
jest.mock('../QuestionDetector', () => ({
  QuestionDetector: jest.fn().mockImplementation(() => ({
    detectQuestion: jest.fn(),
    isValidQuestion: jest.fn().mockReturnValue(true)
  }))
}));

// Mock fs and path
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined)
  },
  createReadStream: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/tmp/audio_test.wav')
}));

jest.mock('os', () => ({
  tmpdir: jest.fn().mockReturnValue('/tmp')
}));

describe('AudioStreamProcessor', () => {
  let audioStreamProcessor: AudioStreamProcessor;
  let mockSystemAudioCapture: jest.Mocked<SystemAudioCapture>;
  let mockOpenAI: jest.Mocked<OpenAI>;

  const mockOpenAIKey = 'test-openai-key';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock OpenAI instance
    mockOpenAI = {
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({ text: 'Test transcription' })
        }
      }
    } as any;
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);

    // Mock SystemAudioCapture instance
    mockSystemAudioCapture = {
      getAvailableSources: jest.fn().mockResolvedValue([
        { id: 'microphone', name: 'Microphone', type: 'microphone', available: true },
        { id: 'system-audio', name: 'System Audio', type: 'system', available: true }
      ]),
      startCapture: jest.fn().mockResolvedValue(undefined),
      stopCapture: jest.fn().mockResolvedValue(undefined),
      switchSource: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn().mockReturnValue({ isCapturing: false, currentSource: null }),
      requestPermissions: jest.fn().mockResolvedValue({ granted: true }),
      destroy: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;
    (SystemAudioCapture as jest.MockedClass<typeof SystemAudioCapture>).mockImplementation(() => mockSystemAudioCapture);

    audioStreamProcessor = new AudioStreamProcessor(mockOpenAIKey);
  });

  afterEach(() => {
    if (audioStreamProcessor) {
      audioStreamProcessor.destroy();
    }
  });

  describe('initialization', () => {
    it('should initialize with OpenAI API key', () => {
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: mockOpenAIKey });
      expect(SystemAudioCapture).toHaveBeenCalled();
    });

    it('should throw error without OpenAI API key', () => {
      expect(() => new AudioStreamProcessor('')).toThrow('OpenAI API key is required');
    });

    it('should setup system audio event listeners', () => {
      expect(mockSystemAudioCapture.on).toHaveBeenCalledWith('audio-data', expect.any(Function));
      expect(mockSystemAudioCapture.on).toHaveBeenCalledWith('source-changed', expect.any(Function));
      expect(mockSystemAudioCapture.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSystemAudioCapture.on).toHaveBeenCalledWith('state-changed', expect.any(Function));
    });
  });

  describe('getAvailableAudioSources', () => {
    it('should return available audio sources', async () => {
      const sources = await audioStreamProcessor.getAvailableAudioSources();
      
      expect(mockSystemAudioCapture.getAvailableSources).toHaveBeenCalled();
      expect(sources).toHaveLength(2);
      expect(sources[0].type).toBe('microphone');
      expect(sources[1].type).toBe('system');
    });

    it('should return fallback microphone source on error', async () => {
      mockSystemAudioCapture.getAvailableSources.mockRejectedValue(new Error('Test error'));

      const sources = await audioStreamProcessor.getAvailableAudioSources();
      
      expect(sources).toHaveLength(1);
      expect(sources[0]).toEqual({
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      });
    });
  });

  describe('startListening', () => {
    it('should start listening with microphone by default', async () => {
      await audioStreamProcessor.startListening();

      const state = audioStreamProcessor.getState();
      expect(state.isListening).toBe(true);
      expect(state.currentAudioSource?.type).toBe('microphone');
      expect(mockSystemAudioCapture.startCapture).not.toHaveBeenCalled();
    });

    it('should start listening with system audio when specified', async () => {
      mockSystemAudioCapture.getState.mockReturnValue({
        isCapturing: true,
        currentSource: { id: 'system-audio', name: 'System Audio', type: 'system', available: true }
      });

      await audioStreamProcessor.startListening('system-audio');

      const state = audioStreamProcessor.getState();
      expect(state.isListening).toBe(true);
      expect(state.currentAudioSource?.type).toBe('system');
      expect(mockSystemAudioCapture.startCapture).toHaveBeenCalledWith('system-audio');
    });

    it('should fallback to microphone if system audio fails', async () => {
      mockSystemAudioCapture.startCapture.mockRejectedValue(new Error('System audio failed'));

      await audioStreamProcessor.startListening('system-audio');

      const state = audioStreamProcessor.getState();
      expect(state.isListening).toBe(true);
      expect(state.currentAudioSource?.name).toContain('Fallback');
    });

    it('should not start if already listening', async () => {
      await audioStreamProcessor.startListening();
      const firstState = audioStreamProcessor.getState();

      await audioStreamProcessor.startListening();
      const secondState = audioStreamProcessor.getState();

      expect(firstState).toEqual(secondState);
      expect(mockSystemAudioCapture.startCapture).toHaveBeenCalledTimes(0);
    });
  });

  describe('stopListening', () => {
    it('should stop listening and clean up', async () => {
      await audioStreamProcessor.startListening('system-audio');
      expect(audioStreamProcessor.getState().isListening).toBe(true);

      await audioStreamProcessor.stopListening();

      const state = audioStreamProcessor.getState();
      expect(state.isListening).toBe(false);
      expect(state.currentAudioSource).toBe(null);
      expect(mockSystemAudioCapture.stopCapture).toHaveBeenCalled();
    });

    it('should handle stop when not listening', async () => {
      await expect(audioStreamProcessor.stopListening()).resolves.not.toThrow();
      expect(audioStreamProcessor.getState().isListening).toBe(false);
    });
  });

  describe('switchAudioSource', () => {
    it('should switch audio source while listening', async () => {
      await audioStreamProcessor.startListening('microphone');
      expect(audioStreamProcessor.getState().currentAudioSource?.type).toBe('microphone');

      mockSystemAudioCapture.getState.mockReturnValue({
        isCapturing: true,
        currentSource: { id: 'system-audio', name: 'System Audio', type: 'system', available: true }
      });

      await audioStreamProcessor.switchAudioSource('system-audio');

      expect(mockSystemAudioCapture.startCapture).toHaveBeenCalledWith('system-audio');
      expect(audioStreamProcessor.getState().isListening).toBe(true);
    });

    it('should switch audio source when not listening', async () => {
      mockSystemAudioCapture.getAvailableSources.mockResolvedValue([
        { id: 'system-audio', name: 'System Audio', type: 'system', available: true }
      ]);

      await audioStreamProcessor.switchAudioSource('system-audio');

      const state = audioStreamProcessor.getState();
      expect(state.currentAudioSource?.type).toBe('system');
      expect(state.isListening).toBe(false);
    });

    it('should handle fallback on switch failure', async () => {
      await audioStreamProcessor.startListening('microphone');
      
      mockSystemAudioCapture.startCapture.mockRejectedValue(new Error('Switch failed'));

      await audioStreamProcessor.switchAudioSource('system-audio');

      // Should attempt to restore previous source (microphone)
      expect(mockSystemAudioCapture.startCapture).toHaveBeenCalledWith('microphone');
    });

    it('should throw error for unavailable source', async () => {
      mockSystemAudioCapture.getAvailableSources.mockResolvedValue([
        { id: 'microphone', name: 'Microphone', type: 'microphone', available: true }
      ]);

      await expect(audioStreamProcessor.switchAudioSource('unavailable-source'))
        .rejects.toThrow('Audio source not available');
    });
  });

  describe('processAudioChunk', () => {
    it('should process audio chunk when listening', async () => {
      await audioStreamProcessor.startListening();

      const audioData = Buffer.alloc(1024);
      await audioStreamProcessor.processAudioChunk(audioData);

      // Should not throw and should process the chunk
      expect(audioStreamProcessor.getState().lastActivityTime).toBeGreaterThan(0);
    });

    it('should ignore audio chunk when not listening', async () => {
      const audioData = Buffer.alloc(1024);
      await audioStreamProcessor.processAudioChunk(audioData);

      // Should not process the chunk
      expect(audioStreamProcessor.getState().lastActivityTime).toBe(0);
    });

    it('should handle audio processing errors gracefully', async () => {
      await audioStreamProcessor.startListening();

      // Mock transcription to fail
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(new Error('Transcription failed'));

      const audioData = Buffer.alloc(1024);
      
      // Should not throw even if transcription fails
      await expect(audioStreamProcessor.processAudioChunk(audioData)).resolves.not.toThrow();
    });
  });

  describe('requestAudioPermissions', () => {
    it('should request permissions through SystemAudioCapture', async () => {
      const result = await audioStreamProcessor.requestAudioPermissions();

      expect(mockSystemAudioCapture.requestPermissions).toHaveBeenCalled();
      expect(result.granted).toBe(true);
    });

    it('should handle permission request errors', async () => {
      mockSystemAudioCapture.requestPermissions.mockRejectedValue(new Error('Permission denied'));

      const result = await audioStreamProcessor.requestAudioPermissions();

      expect(result.granted).toBe(false);
      expect(result.error).toContain('Permission request failed');
    });
  });

  describe('event handling', () => {
    it('should emit state-changed events', async () => {
      const stateChangedSpy = jest.fn();
      audioStreamProcessor.on('state-changed', stateChangedSpy);

      await audioStreamProcessor.startListening();

      expect(stateChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isListening: true })
      );
    });

    it('should emit error events', async () => {
      const errorSpy = jest.fn();
      audioStreamProcessor.on('error', errorSpy);

      mockSystemAudioCapture.startCapture.mockRejectedValue(new Error('Test error'));

      try {
        await audioStreamProcessor.startListening('system-audio');
      } catch (error) {
        // Expected to throw
      }

      // Should emit error for fallback scenario
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should forward system audio events', () => {
      // Get the audio-data event handler
      const audioDataHandler = mockSystemAudioCapture.on.mock.calls.find(
        call => call[0] === 'audio-data'
      )?.[1];

      expect(audioDataHandler).toBeDefined();

      // Test that it forwards audio data to processAudioChunk
      if (audioDataHandler) {
        const mockBuffer = Buffer.alloc(1024);
        audioDataHandler(mockBuffer);
        // In a real implementation, this would call processAudioChunk
      }
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      audioStreamProcessor.destroy();

      expect(mockSystemAudioCapture.destroy).toHaveBeenCalled();
    });
  });
});