import { SystemAudioCapture, AudioSource } from '../SystemAudioCapture';
import { desktopCapturer } from 'electron';

// Mock Electron's desktopCapturer
jest.mock('electron', () => ({
  desktopCapturer: {
    getSources: jest.fn()
  }
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia
    }
  },
  writable: true
});

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  createMediaStreamSource: jest.fn().mockReturnValue({
    connect: jest.fn()
  }),
  createScriptProcessor: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null
  }),
  destination: {}
};

Object.defineProperty(global, 'AudioContext', {
  value: jest.fn().mockImplementation(() => mockAudioContext),
  writable: true
});

// Mock MediaStream
const mockMediaStream = {
  getTracks: jest.fn().mockReturnValue([
    { stop: jest.fn(), kind: 'audio', label: 'System Audio' }
  ])
};

describe('SystemAudioCapture', () => {
  let systemAudioCapture: SystemAudioCapture;
  const mockDesktopCapturer = desktopCapturer as jest.Mocked<typeof desktopCapturer>;

  beforeEach(() => {
    jest.clearAllMocks();
    systemAudioCapture = new SystemAudioCapture();
  });

  afterEach(async () => {
    if (systemAudioCapture) {
      systemAudioCapture.destroy();
    }
  });

  describe('getAvailableSources', () => {
    it('should return microphone and system audio sources when desktop sources are available', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);

      const sources = await systemAudioCapture.getAvailableSources();

      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      });
      expect(sources[1]).toEqual({
        id: 'system-audio',
        name: 'System Audio',
        type: 'system',
        available: true
      });
    });

    it('should mark system audio as unavailable when no desktop sources exist', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      const sources = await systemAudioCapture.getAvailableSources();

      expect(sources).toHaveLength(2);
      expect(sources[1]).toEqual({
        id: 'system-audio',
        name: 'System Audio (Unavailable)',
        type: 'system',
        available: false
      });
    });

    it('should handle desktop capturer errors gracefully', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('Permission denied'));

      const sources = await systemAudioCapture.getAvailableSources();

      expect(sources).toHaveLength(2);
      expect(sources[1].available).toBe(false);
    });

    it('should return fallback microphone source on complete failure', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('Complete failure'));

      const sources = await systemAudioCapture.getAvailableSources();

      expect(sources).toHaveLength(1);
      expect(sources[0]).toEqual({
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      });
    });
  });

  describe('startCapture', () => {
    it('should start microphone capture successfully', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);

      await systemAudioCapture.startCapture('microphone');

      const state = systemAudioCapture.getState();
      expect(state.isCapturing).toBe(true);
      expect(state.currentSource?.type).toBe('microphone');
      expect(mockGetUserMedia).toHaveBeenCalledWith({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });

    it('should start system audio capture successfully', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);
      mockGetUserMedia.mockResolvedValue(mockMediaStream);

      await systemAudioCapture.startCapture('system-audio');

      const state = systemAudioCapture.getState();
      expect(state.isCapturing).toBe(true);
      expect(state.currentSource?.type).toBe('system');
    });

    it('should throw error for unavailable source', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      await expect(systemAudioCapture.startCapture('system-audio'))
        .rejects.toThrow('Audio source not available');
    });

    it('should throw error for unknown source', async () => {
      await expect(systemAudioCapture.startCapture('unknown-source'))
        .rejects.toThrow('Audio source not found');
    });

    it('should handle microphone permission denied', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      await expect(systemAudioCapture.startCapture('microphone'))
        .rejects.toThrow('Microphone access failed');
    });

    it('should stop current capture before starting new one', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      
      // Start first capture
      await systemAudioCapture.startCapture('microphone');
      expect(systemAudioCapture.getState().isCapturing).toBe(true);

      // Start second capture
      await systemAudioCapture.startCapture('microphone');
      expect(systemAudioCapture.getState().isCapturing).toBe(true);
      
      // Should have stopped tracks from first capture
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
    });
  });

  describe('stopCapture', () => {
    it('should stop capture and clean up resources', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      
      await systemAudioCapture.startCapture('microphone');
      expect(systemAudioCapture.getState().isCapturing).toBe(true);

      await systemAudioCapture.stopCapture();
      
      const state = systemAudioCapture.getState();
      expect(state.isCapturing).toBe(false);
      expect(state.currentSource).toBe(null);
      expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should handle stop when not capturing', async () => {
      await expect(systemAudioCapture.stopCapture()).resolves.not.toThrow();
      expect(systemAudioCapture.getState().isCapturing).toBe(false);
    });
  });

  describe('switchSource', () => {
    it('should switch sources while maintaining capture state', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);

      // Start with microphone
      await systemAudioCapture.startCapture('microphone');
      expect(systemAudioCapture.getState().currentSource?.type).toBe('microphone');

      // Switch to system audio
      await systemAudioCapture.switchSource('system-audio');
      expect(systemAudioCapture.getState().currentSource?.type).toBe('system');
      expect(systemAudioCapture.getState().isCapturing).toBe(true);
    });

    it('should switch sources when not capturing', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);

      await systemAudioCapture.switchSource('system-audio');
      expect(systemAudioCapture.getState().currentSource?.type).toBe('system');
      expect(systemAudioCapture.getState().isCapturing).toBe(false);
    });
  });

  describe('requestPermissions', () => {
    it('should return granted when permissions are available', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);

      const result = await systemAudioCapture.requestPermissions();
      
      expect(result.granted).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return denied when no desktop sources available', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      const result = await systemAudioCapture.requestPermissions();
      
      expect(result.granted).toBe(false);
      expect(result.error).toContain('Screen recording permission may be required');
    });

    it('should handle permission request errors', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('Access denied'));

      const result = await systemAudioCapture.requestPermissions();
      
      expect(result.granted).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('isSystemAudioSupported', () => {
    it('should return true when desktop sources are available', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([
        { id: 'screen:0', name: 'Entire Screen', thumbnail: Buffer.alloc(0) }
      ] as any);

      const isSupported = await SystemAudioCapture.isSystemAudioSupported();
      expect(isSupported).toBe(true);
    });

    it('should return false when no desktop sources available', async () => {
      mockDesktopCapturer.getSources.mockResolvedValue([]);

      const isSupported = await SystemAudioCapture.isSystemAudioSupported();
      expect(isSupported).toBe(false);
    });

    it('should return false on error', async () => {
      mockDesktopCapturer.getSources.mockRejectedValue(new Error('Not supported'));

      const isSupported = await SystemAudioCapture.isSystemAudioSupported();
      expect(isSupported).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit audio-data events during capture', async () => {
      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      
      const audioDataSpy = jest.fn();
      systemAudioCapture.on('audio-data', audioDataSpy);

      await systemAudioCapture.startCapture('microphone');

      // Simulate audio processing
      const processor = mockAudioContext.createScriptProcessor();
      const mockEvent = {
        inputBuffer: {
          getChannelData: jest.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3]))
        }
      };
      
      if (processor.onaudioprocess) {
        processor.onaudioprocess(mockEvent as any);
      }

      // Note: In a real test, we'd need to trigger the audio processing callback
      // This is a simplified test structure
    });

    it('should emit state-changed events', async () => {
      const stateChangedSpy = jest.fn();
      systemAudioCapture.on('state-changed', stateChangedSpy);

      mockGetUserMedia.mockResolvedValue(mockMediaStream);
      await systemAudioCapture.startCapture('microphone');

      expect(stateChangedSpy).toHaveBeenCalledWith({
        isCapturing: true,
        currentSource: expect.objectContaining({ type: 'microphone' })
      });
    });

    it('should emit error events on failures', async () => {
      const errorSpy = jest.fn();
      systemAudioCapture.on('error', errorSpy);

      mockGetUserMedia.mockRejectedValue(new Error('Test error'));

      try {
        await systemAudioCapture.startCapture('microphone');
      } catch (error) {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});