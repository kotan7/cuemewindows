import '@testing-library/jest-dom';

// Mock electron API
const mockElectronAPI = {
  audioGetSources: jest.fn(),
  audioSwitchSource: jest.fn(),
  audioRequestPermissions: jest.fn(),
  audioCheckSystemSupport: jest.fn(),
  audioStreamStart: jest.fn(),
  audioStreamStop: jest.fn(),
  audioStreamProcessChunk: jest.fn(),
  audioStreamGetState: jest.fn(),
  audioStreamGetQuestions: jest.fn(),
  audioStreamClearQuestions: jest.fn(),
  audioStreamAnswerQuestion: jest.fn(),
  onAudioQuestionDetected: jest.fn(),
  onAudioStreamStateChanged: jest.fn(),
  onAudioStreamError: jest.fn(),
  invoke: jest.fn()
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});