import { PerformanceMonitor } from '../PerformanceMonitor';

// Global performance monitor instance
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function setGlobalPerformanceMonitor(monitor: PerformanceMonitor): void {
  globalPerformanceMonitor = monitor;
}

export function getGlobalPerformanceMonitor(): PerformanceMonitor | null {
  return globalPerformanceMonitor;
}

/**
 * Decorator to measure execution time of methods
 */
export function measureTime(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        monitor.startTiming(operationId, operation, {
          className: target.constructor.name,
          methodName: propertyKey,
          argsCount: args.length,
        });

        const result = await originalMethod.apply(this, args);
        
        monitor.endTiming(operationId);
        return result;
      } catch (error) {
        monitor.endTiming(operationId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to measure memory usage before and after method execution
 */
export function measureMemory(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const beforeMemory = process.memoryUsage();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        const afterMemory = process.memoryUsage();
        const memoryDelta = afterMemory.heapUsed - beforeMemory.heapUsed;
        
        // Record memory usage change
        monitor.recordMetric('systemResources', 'memoryUsage', afterMemory.rss);
        
        if (Math.abs(memoryDelta) > 1024 * 1024) { // Log if > 1MB change
          console.log(`[PerformanceDecorator] ${operation} memory change: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
        }
        
        return result;
      } catch (error) {
        const afterMemory = process.memoryUsage();
        monitor.recordMetric('systemResources', 'memoryUsage', afterMemory.rss);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to track API call metrics
 */
export function trackApiCall(apiName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `api-${apiName}-${Date.now()}`;
      
      try {
        monitor.startTiming(operationId, `API Call: ${apiName}`);
        monitor.incrementCounter('llmProcessing', 'apiCallCount');
        
        const result = await originalMethod.apply(this, args);
        
        monitor.endTiming(operationId);
        return result;
      } catch (error) {
        monitor.endTiming(operationId);
        // Track error rate
        const currentErrorRate = monitor.getMetrics().userExperience.errorRate;
        monitor.recordMetric('userExperience', 'errorRate', Math.min(currentErrorRate + 0.01, 1.0));
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to track cache operations
 */
export function trackCache(cacheType: 'hit' | 'miss') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      const result = await originalMethod.apply(this, args);
      
      if (monitor) {
        monitor.recordCacheHit(cacheType === 'hit');
      }
      
      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to measure audio processing operations
 */
export function measureAudioProcessing(operationType: 'chunk' | 'transcription' | 'question-detection') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = `Audio ${operationType}: ${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `audio-${operationType}-${Date.now()}`;
      
      try {
        monitor.startTiming(operationId, operation);
        
        const result = await originalMethod.apply(this, args);
        
        const duration = monitor.endTiming(operationId);
        
        // Update specific audio metrics
        if (duration !== null) {
          switch (operationType) {
            case 'chunk':
              monitor.recordMetric('audioProcessing', 'chunkProcessingTime', duration);
              break;
            case 'transcription':
              monitor.recordMetric('audioProcessing', 'transcriptionLatency', duration);
              break;
            case 'question-detection':
              monitor.recordMetric('audioProcessing', 'questionDetectionTime', duration);
              break;
          }
        }
        
        return result;
      } catch (error) {
        monitor.endTiming(operationId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to measure LLM operations
 */
export function measureLLMOperation(operationType: 'response-generation' | 'rag-retrieval') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = `LLM ${operationType}: ${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `llm-${operationType}-${Date.now()}`;
      
      try {
        monitor.startTiming(operationId, operation);
        
        const result = await originalMethod.apply(this, args);
        
        const duration = monitor.endTiming(operationId);
        
        // Update specific LLM metrics
        if (duration !== null) {
          switch (operationType) {
            case 'response-generation':
              monitor.recordMetric('llmProcessing', 'responseGenerationTime', duration);
              break;
            case 'rag-retrieval':
              monitor.recordMetric('llmProcessing', 'ragRetrievalTime', duration);
              break;
          }
        }
        
        return result;
      } catch (error) {
        monitor.endTiming(operationId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator to measure end-to-end user experience
 */
export function measureEndToEnd(operationName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const operation = `End-to-End: ${operationName}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const operationId = `e2e-${operationName}-${Date.now()}`;
      
      try {
        monitor.startTiming(operationId, operation);
        
        const result = await originalMethod.apply(this, args);
        
        const duration = monitor.endTiming(operationId);
        
        // Update end-to-end latency metric
        if (duration !== null) {
          monitor.recordMetric('userExperience', 'endToEndLatency', duration);
        }
        
        return result;
      } catch (error) {
        monitor.endTiming(operationId);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator to automatically add performance monitoring to all methods
 */
export function MonitorPerformance(options: {
  includePrivate?: boolean;
  excludeMethods?: string[];
  operationPrefix?: string;
} = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const { includePrivate = false, excludeMethods = [], operationPrefix = '' } = options;
    
    const prototype = constructor.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);
    
    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;
      if (!includePrivate && propertyName.startsWith('_')) continue;
      if (excludeMethods.includes(propertyName)) continue;
      
      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (!descriptor || typeof descriptor.value !== 'function') continue;
      
      const operationName = operationPrefix ? `${operationPrefix}.${propertyName}` : `${constructor.name}.${propertyName}`;
      
      // Apply timing decorator
      const timingDecorator = measureTime(operationName);
      timingDecorator(prototype, propertyName, descriptor);
      
      Object.defineProperty(prototype, propertyName, descriptor);
    }
    
    return constructor;
  };
}