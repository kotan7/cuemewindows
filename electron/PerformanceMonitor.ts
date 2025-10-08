import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  audioProcessing: {
    chunkProcessingTime: number;
    transcriptionLatency: number;
    questionDetectionTime: number;
    averageChunkSize: number;
  };
  
  llmProcessing: {
    responseGenerationTime: number;
    ragRetrievalTime: number;
    cacheHitRate: number;
    apiCallCount: number;
  };
  
  systemResources: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    heapUsed: number;
    heapTotal: number;
  };
  
  userExperience: {
    endToEndLatency: number;
    accuracyScore: number;
    satisfactionRating: number;
    errorRate: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'latency' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metrics: Partial<PerformanceMetrics>;
}

export interface TimingEntry {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private timingEntries: Map<string, TimingEntry> = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Thresholds for alerts
  private readonly thresholds = {
    memory: {
      warning: 200 * 1024 * 1024, // 200MB
      critical: 500 * 1024 * 1024, // 500MB
    },
    cpu: {
      warning: 70, // 70%
      critical: 90, // 90%
    },
    latency: {
      audioProcessing: 500, // 500ms
      llmResponse: 2000, // 2 seconds
      endToEnd: 3000, // 3 seconds
    },
    errorRate: {
      warning: 0.05, // 5%
      critical: 0.15, // 15%
    }
  };

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      audioProcessing: {
        chunkProcessingTime: 0,
        transcriptionLatency: 0,
        questionDetectionTime: 0,
        averageChunkSize: 0,
      },
      llmProcessing: {
        responseGenerationTime: 0,
        ragRetrievalTime: 0,
        cacheHitRate: 0,
        apiCallCount: 0,
      },
      systemResources: {
        memoryUsage: 0,
        cpuUsage: 0,
        networkLatency: 0,
        heapUsed: 0,
        heapTotal: 0,
      },
      userExperience: {
        endToEndLatency: 0,
        accuracyScore: 0,
        satisfactionRating: 0,
        errorRate: 0,
      },
    };
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.checkThresholds();
      this.emit('metrics-updated', this.getMetrics());
    }, 1000); // Collect metrics every second

    console.log('[PerformanceMonitor] Started monitoring');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('[PerformanceMonitor] Stopped monitoring');
  }

  /**
   * Start timing an operation
   */
  public startTiming(operationId: string, operation: string, metadata?: Record<string, any>): void {
    const entry: TimingEntry = {
      operation,
      startTime: performance.now(),
      metadata,
    };
    
    this.timingEntries.set(operationId, entry);
  }

  /**
   * End timing an operation and record the duration
   */
  public endTiming(operationId: string): number | null {
    const entry = this.timingEntries.get(operationId);
    if (!entry) {
      console.warn(`[PerformanceMonitor] No timing entry found for operation: ${operationId}`);
      return null;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    
    // Update relevant metrics based on operation type
    this.updateMetricsFromTiming(entry);
    
    // Clean up the timing entry
    this.timingEntries.delete(operationId);
    
    console.log(`[PerformanceMonitor] ${entry.operation} completed in ${entry.duration.toFixed(2)}ms`);
    
    return entry.duration;
  }

  /**
   * Record a metric value directly
   */
  public recordMetric(category: keyof PerformanceMetrics, metric: string, value: number): void {
    if (this.metrics[category] && metric in this.metrics[category]) {
      (this.metrics[category] as any)[metric] = value;
      this.emit('metric-recorded', { category, metric, value });
    }
  }

  /**
   * Increment a counter metric
   */
  public incrementCounter(category: keyof PerformanceMetrics, metric: string, increment: number = 1): void {
    if (this.metrics[category] && metric in this.metrics[category]) {
      (this.metrics[category] as any)[metric] += increment;
      this.emit('metric-incremented', { category, metric, value: (this.metrics[category] as any)[metric] });
    }
  }

  /**
   * Calculate and record cache hit rate
   */
  public recordCacheHit(isHit: boolean): void {
    // Simple moving average for cache hit rate
    const currentRate = this.metrics.llmProcessing.cacheHitRate;
    const newRate = isHit ? 1 : 0;
    this.metrics.llmProcessing.cacheHitRate = (currentRate * 0.9) + (newRate * 0.1);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit?: number): PerformanceMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  /**
   * Get current alerts
   */
  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  public clearAlerts(olderThan?: number): void {
    const cutoff = olderThan || (Date.now() - 5 * 60 * 1000); // 5 minutes default
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Collect system resource metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.metrics.systemResources.memoryUsage = memUsage.rss;
    this.metrics.systemResources.heapUsed = memUsage.heapUsed;
    this.metrics.systemResources.heapTotal = memUsage.heapTotal;
    
    // CPU usage would require additional monitoring (simplified here)
    // In a real implementation, you'd use process.cpuUsage() with proper calculation
    
    // Store metrics history (keep last 100 entries)
    this.metricsHistory.push({ ...this.metrics });
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Update metrics based on timing information
   */
  private updateMetricsFromTiming(entry: TimingEntry): void {
    if (!entry.duration) return;

    const operation = entry.operation.toLowerCase();
    
    if (operation.includes('audio') || operation.includes('chunk')) {
      this.metrics.audioProcessing.chunkProcessingTime = entry.duration;
    } else if (operation.includes('transcription')) {
      this.metrics.audioProcessing.transcriptionLatency = entry.duration;
    } else if (operation.includes('question')) {
      this.metrics.audioProcessing.questionDetectionTime = entry.duration;
    } else if (operation.includes('llm') || operation.includes('response')) {
      this.metrics.llmProcessing.responseGenerationTime = entry.duration;
    } else if (operation.includes('rag') || operation.includes('search')) {
      this.metrics.llmProcessing.ragRetrievalTime = entry.duration;
    } else if (operation.includes('end-to-end')) {
      this.metrics.userExperience.endToEndLatency = entry.duration;
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(): void {
    // Memory usage alerts
    const memUsage = this.metrics.systemResources.memoryUsage;
    if (memUsage > this.thresholds.memory.critical) {
      this.createAlert('memory', 'critical', `Critical memory usage: ${(memUsage / 1024 / 1024).toFixed(1)}MB`);
    } else if (memUsage > this.thresholds.memory.warning) {
      this.createAlert('memory', 'medium', `High memory usage: ${(memUsage / 1024 / 1024).toFixed(1)}MB`);
    }

    // Latency alerts
    const audioLatency = this.metrics.audioProcessing.chunkProcessingTime;
    if (audioLatency > this.thresholds.latency.audioProcessing) {
      this.createAlert('latency', 'medium', `Slow audio processing: ${audioLatency.toFixed(1)}ms`);
    }

    const llmLatency = this.metrics.llmProcessing.responseGenerationTime;
    if (llmLatency > this.thresholds.latency.llmResponse) {
      this.createAlert('latency', 'medium', `Slow LLM response: ${llmLatency.toFixed(1)}ms`);
    }

    const endToEndLatency = this.metrics.userExperience.endToEndLatency;
    if (endToEndLatency > this.thresholds.latency.endToEnd) {
      this.createAlert('latency', 'high', `Slow end-to-end response: ${endToEndLatency.toFixed(1)}ms`);
    }
  }

  /**
   * Create and emit a performance alert
   */
  private createAlert(type: PerformanceAlert['type'], severity: PerformanceAlert['severity'], message: string): void {
    const alert: PerformanceAlert = {
      id: `${type}-${Date.now()}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      metrics: { ...this.metrics },
    };

    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    this.emit('alert', alert);
    console.warn(`[PerformanceMonitor] ${severity.toUpperCase()} ALERT: ${message}`);
  }

  /**
   * Generate performance report
   */
  public generateReport(): {
    summary: Record<string, any>;
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Analyze metrics and provide recommendations
    if (this.metrics.systemResources.memoryUsage > this.thresholds.memory.warning) {
      recommendations.push('Consider implementing more aggressive garbage collection or reducing cache sizes');
    }
    
    if (this.metrics.audioProcessing.chunkProcessingTime > 300) {
      recommendations.push('Audio processing is slower than optimal - consider optimizing chunk size or processing algorithms');
    }
    
    if (this.metrics.llmProcessing.cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low - consider improving caching strategies or increasing cache size');
    }
    
    if (this.metrics.llmProcessing.responseGenerationTime > 1500) {
      recommendations.push('LLM response times are high - consider connection pooling or response streaming');
    }

    return {
      summary: {
        monitoringDuration: this.metricsHistory.length,
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length,
        averageMemoryUsage: this.calculateAverage('systemResources.memoryUsage'),
        averageResponseTime: this.calculateAverage('llmProcessing.responseGenerationTime'),
      },
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      recommendations,
    };
  }

  /**
   * Calculate average for a metric over history
   */
  private calculateAverage(metricPath: string): number {
    if (this.metricsHistory.length === 0) return 0;
    
    const values = this.metricsHistory.map(metrics => {
      const parts = metricPath.split('.');
      let value: any = metrics;
      for (const part of parts) {
        value = value?.[part];
      }
      return typeof value === 'number' ? value : 0;
    });
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}