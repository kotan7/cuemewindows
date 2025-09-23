// Test setup file for Jest

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock timers for tests that use setTimeout/setInterval
jest.useFakeTimers();

// Global test utilities
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Mock Buffer if not available in test environment
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// Mock performance API
if (typeof performance === 'undefined') {
  global.performance = {
    now: jest.fn(() => Date.now())
  } as any;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});