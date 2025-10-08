/**
 * Centralized logging utility for electron main process
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  debug(...args: any[]): void {
    console.log(`[${this.prefix}] [DEBUG]`, ...args);
  }

  info(...args: any[]): void {
    console.log(`[${this.prefix}] [INFO]`, ...args);
  }

  warn(...args: any[]): void {
    console.warn(`[${this.prefix}] [WARN]`, ...args);
  }

  error(...args: any[]): void {
    console.error(`[${this.prefix}] [ERROR]`, ...args);
  }
}

/**
 * Create a logger instance with a specific prefix
 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}

/**
 * Default logger for general use
 */
export const logger = createLogger('Electron');
