import { EventEmitter } from "events";
import { measureTime, measureMemory } from "./decorators/PerformanceDecorators";

export interface QualitySettings {
  audioProcessingQuality: number; // 0.0 - 1.0
  transcriptionAccuracy: number;  // 0.0 - 1.0
  llmResponseQuality: number;     // 0.0 - 1.0
  cacheAggressiveness: number;    // 0.0 - 1.0
  parallelProcessing: boolean;
  streamingEnabled: boolean;
}

export interface SystemLoadMetrics {
  cpuUsage: number;        // 0.0 - 1.0
  memoryUsage: number;     // bytes
  networkLatency: number;  // ms
  batteryLevel?: number;   // 0.0 - 1.0
  thermalState?: 'normal' | 'fair' | 'serious' | 'critical';
}

export interface UserContext {
  mode: 'interview' | 'meeting' | 'casual' | 'presentation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  userActivity: 'active' | 'idle' | 'away';
  networkCondition: 'fast' | 'medium' | 'slow' | 'offline';
  deviceType: 'desktop' | 'laptop' | 'mobile';
}

export interface QualityAdjustment {
  component: string;
  originalValue: number;
  adjustedValue: number;
  reason: string;
  impact: 'low' | 'medium' | 'high';
  performanceGain: number; // estimated percentage
}

export interface AdaptiveDecision {
  timestamp: number;
  systemLoad: SystemLoadMetrics;
  userContext: UserContext;
  qualitySettings: QualitySettings;
  adjustments: QualityAdjustment[];
  confidence: number;
  estimatedPerformanceGain: number;
}

/**
 * Adaptive Quality Manager for dynamic quality vs speed trade-offs
 * Requirement 9.1: Quality vs speed trade-offs based on system state
 * Requirement 9.2: User preference learning for quality settings
 * Requirement 9.3: Context-aware processing modes
 */
export class AdaptiveQualityManager extends EventEmitter {
  private currentSettings: QualitySettings;
  private baselineSettings: QualitySettings;
  private userPreferences: Map<string, number> = new Map();
  private decisionHistory: AdaptiveDecision[] = [];
  private learningEnabled: boolean = true;
  private adaptationThresholds: {
    cpu: { low: 0.3; medium: 0.6; high: 0.8; critical: 0.95 };
    memory: { low: 100; medium: 200; high: 400; critical: 600 }; // MB
    latency: { low: 100; medium: 300; high: 1000; critical: 3000 }; // ms
  };

  constructor() {
    super();
    
    this.baselineSettings = {
      audioProcessingQuality: 0.9,
      transcriptionAccuracy: 0.95,
      llmResponseQuality: 0.9,
      cacheAggressiveness: 0.7,
      parallelProcessing: true,
      streamingEnabled: true
    };
    
    this.currentSettings = { ...this.baselineSettings };
    
    this.adaptationThresholds = {
      cpu: { low: 0.3, medium: 0.6, high: 0.8, critical: 0.95 },
      memory: { low: 100, medium: 200, high: 400, critical: 600 }, // MB
      latency: { low: 100, medium: 300, high: 1000, critical: 3000 } // ms
    };
    
    console.log('[AdaptiveQualityManager] Initialized with baseline settings:', this.baselineSettings);
  }

  /**
   * Adapt quality settings based on system load and user context
   * Requirement 9.1: Automatic quality reduction when system load is high
   */
    // @measureTime('AdaptiveQualityManager.adaptQuality')
    // @measureMemory('AdaptiveQualityManager.adaptQuality')
  public async adaptQuality(
    systemLoad: SystemLoadMetrics, 
    userContext: UserContext
  ): Promise<AdaptiveDecision> {
    const startTime = Date.now();
    
    console.log('[AdaptiveQualityManager] Adapting quality for system load:', {
      cpu: (systemLoad.cpuUsage * 100).toFixed(1) + '%',
      memory: (systemLoad.memoryUsage / 1024 / 1024).toFixed(1) + 'MB',
      latency: systemLoad.networkLatency + 'ms',
      mode: userContext.mode,
      priority: userContext.priority
    });

    // Create new quality settings based on analysis
    const newSettings = { ...this.currentSettings };
    const adjustments: QualityAdjustment[] = [];
    
    // Analyze system load and make adjustments
    const loadLevel = this.analyzeSystemLoad(systemLoad);
    const contextRequirements = this.analyzeUserContext(userContext);
    
    // Apply CPU-based adjustments
    if (systemLoad.cpuUsage > this.adaptationThresholds.cpu.high) {
      const cpuAdjustments = this.applyCPUOptimizations(newSettings, systemLoad.cpuUsage);
      adjustments.push(...cpuAdjustments);
    }
    
    // Apply memory-based adjustments
    const memoryMB = systemLoad.memoryUsage / 1024 / 1024;
    if (memoryMB > this.adaptationThresholds.memory.high) {
      const memoryAdjustments = this.applyMemoryOptimizations(newSettings, memoryMB);
      adjustments.push(...memoryAdjustments);
    }
    
    // Apply network-based adjustments
    if (systemLoad.networkLatency > this.adaptationThresholds.latency.medium) {
      const networkAdjustments = this.applyNetworkOptimizations(newSettings, systemLoad.networkLatency);
      adjustments.push(...networkAdjustments);
    }
    
    // Apply context-based adjustments
    const contextAdjustments = this.applyContextOptimizations(newSettings, userContext);
    adjustments.push(...contextAdjustments);
    
    // Apply battery-aware optimizations if available
    if (systemLoad.batteryLevel !== undefined && systemLoad.batteryLevel < 0.2) {
      const batteryAdjustments = this.applyBatteryOptimizations(newSettings, systemLoad.batteryLevel);
      adjustments.push(...batteryAdjustments);
    }
    
    // Calculate confidence and performance gain
    const confidence = this.calculateConfidence(systemLoad, userContext, adjustments);
    const estimatedPerformanceGain = this.calculatePerformanceGain(adjustments);
    
    // Create decision record
    const decision: AdaptiveDecision = {
      timestamp: startTime,
      systemLoad,
      userContext,
      qualitySettings: newSettings,
      adjustments,
      confidence,
      estimatedPerformanceGain
    };
    
    // Apply the new settings
    this.currentSettings = newSettings;
    
    // Store decision for learning
    this.recordDecision(decision);
    
    // Learn from user feedback if available
    if (this.learningEnabled) {
      this.updateUserPreferences(userContext, adjustments);
    }
    
    console.log(`[AdaptiveQualityManager] Quality adapted with ${adjustments.length} adjustments, estimated gain: ${estimatedPerformanceGain.toFixed(1)}%`);
    
    this.emit('quality-adapted', decision);
    return decision;
  }

  /**
   * Apply CPU-based optimizations
   */
  private applyCPUOptimizations(settings: QualitySettings, cpuUsage: number): QualityAdjustment[] {
    const adjustments: QualityAdjustment[] = [];
    
    if (cpuUsage > this.adaptationThresholds.cpu.critical) {
      // Critical CPU usage - aggressive optimizations
      adjustments.push({
        component: 'audioProcessingQuality',
        originalValue: settings.audioProcessingQuality,
        adjustedValue: Math.max(0.5, settings.audioProcessingQuality * 0.6),
        reason: 'Critical CPU usage detected',
        impact: 'high',
        performanceGain: 35
      });
      
      adjustments.push({
        component: 'parallelProcessing',
        originalValue: settings.parallelProcessing ? 1 : 0,
        adjustedValue: 0,
        reason: 'Disable parallel processing to reduce CPU load',
        impact: 'medium',
        performanceGain: 20
      });
      
      settings.audioProcessingQuality = Math.max(0.5, settings.audioProcessingQuality * 0.6);
      settings.parallelProcessing = false;
      
    } else if (cpuUsage > this.adaptationThresholds.cpu.high) {
      // High CPU usage - moderate optimizations
      adjustments.push({
        component: 'audioProcessingQuality',
        originalValue: settings.audioProcessingQuality,
        adjustedValue: Math.max(0.7, settings.audioProcessingQuality * 0.8),
        reason: 'High CPU usage detected',
        impact: 'medium',
        performanceGain: 20
      });
      
      settings.audioProcessingQuality = Math.max(0.7, settings.audioProcessingQuality * 0.8);
    }
    
    return adjustments;
  }

  /**
   * Apply memory-based optimizations
   */
  private applyMemoryOptimizations(settings: QualitySettings, memoryMB: number): QualityAdjustment[] {
    const adjustments: QualityAdjustment[] = [];
    
    if (memoryMB > this.adaptationThresholds.memory.critical) {
      // Critical memory usage
      adjustments.push({
        component: 'cacheAggressiveness',
        originalValue: settings.cacheAggressiveness,
        adjustedValue: Math.min(0.3, settings.cacheAggressiveness * 0.5),
        reason: 'Critical memory usage - reduce cache size',
        impact: 'high',
        performanceGain: 30
      });
      
      settings.cacheAggressiveness = Math.min(0.3, settings.cacheAggressiveness * 0.5);
      
    } else if (memoryMB > this.adaptationThresholds.memory.high) {
      // High memory usage
      adjustments.push({
        component: 'cacheAggressiveness',
        originalValue: settings.cacheAggressiveness,
        adjustedValue: Math.min(0.5, settings.cacheAggressiveness * 0.7),
        reason: 'High memory usage - moderate cache reduction',
        impact: 'medium',
        performanceGain: 15
      });
      
      settings.cacheAggressiveness = Math.min(0.5, settings.cacheAggressiveness * 0.7);
    }
    
    return adjustments;
  }

  /**
   * Apply network-based optimizations
   */
  private applyNetworkOptimizations(settings: QualitySettings, latency: number): QualityAdjustment[] {
    const adjustments: QualityAdjustment[] = [];
    
    if (latency > this.adaptationThresholds.latency.critical) {
      // Critical network latency
      adjustments.push({
        component: 'streamingEnabled',
        originalValue: settings.streamingEnabled ? 1 : 0,
        adjustedValue: 0,
        reason: 'Critical network latency - disable streaming',
        impact: 'high',
        performanceGain: 25
      });
      
      adjustments.push({
        component: 'cacheAggressiveness',
        originalValue: settings.cacheAggressiveness,
        adjustedValue: Math.min(1.0, settings.cacheAggressiveness * 1.3),
        reason: 'High latency - increase caching',
        impact: 'medium',
        performanceGain: 20
      });
      
      settings.streamingEnabled = false;
      settings.cacheAggressiveness = Math.min(1.0, settings.cacheAggressiveness * 1.3);
      
    } else if (latency > this.adaptationThresholds.latency.high) {
      // High network latency
      adjustments.push({
        component: 'cacheAggressiveness',
        originalValue: settings.cacheAggressiveness,
        adjustedValue: Math.min(1.0, settings.cacheAggressiveness * 1.2),
        reason: 'High latency - increase caching',
        impact: 'low',
        performanceGain: 10
      });
      
      settings.cacheAggressiveness = Math.min(1.0, settings.cacheAggressiveness * 1.2);
    }
    
    return adjustments;
  }

  /**
   * Apply context-based optimizations
   * Requirement 9.3: Context-aware processing modes
   */
  private applyContextOptimizations(settings: QualitySettings, context: UserContext): QualityAdjustment[] {
    const adjustments: QualityAdjustment[] = [];
    
    // Mode-specific optimizations
    switch (context.mode) {
      case 'interview':
        if (context.priority === 'critical') {
          // Interview mode with critical priority - maximize quality
          adjustments.push({
            component: 'transcriptionAccuracy',
            originalValue: settings.transcriptionAccuracy,
            adjustedValue: Math.min(1.0, settings.transcriptionAccuracy * 1.1),
            reason: 'Critical interview mode - maximize accuracy',
            impact: 'medium',
            performanceGain: -10 // Negative gain for quality increase
          });
          
          settings.transcriptionAccuracy = Math.min(1.0, settings.transcriptionAccuracy * 1.1);
        }
        break;
        
      case 'meeting':
        // Meeting mode - balance speed and quality
        if (settings.audioProcessingQuality > 0.8) {
          adjustments.push({
            component: 'audioProcessingQuality',
            originalValue: settings.audioProcessingQuality,
            adjustedValue: 0.8,
            reason: 'Meeting mode - optimize for real-time processing',
            impact: 'low',
            performanceGain: 15
          });
          
          settings.audioProcessingQuality = 0.8;
        }
        break;
        
      case 'casual':
        // Casual mode - prioritize speed
        adjustments.push({
          component: 'llmResponseQuality',
          originalValue: settings.llmResponseQuality,
          adjustedValue: Math.max(0.6, settings.llmResponseQuality * 0.8),
          reason: 'Casual mode - prioritize speed over quality',
          impact: 'medium',
          performanceGain: 25
        });
        
        settings.llmResponseQuality = Math.max(0.6, settings.llmResponseQuality * 0.8);
        break;
    }
    
    // Network condition optimizations
    if (context.networkCondition === 'slow' || context.networkCondition === 'offline') {
      adjustments.push({
        component: 'cacheAggressiveness',
        originalValue: settings.cacheAggressiveness,
        adjustedValue: Math.min(1.0, settings.cacheAggressiveness * 1.5),
        reason: 'Poor network - increase local caching',
        impact: 'high',
        performanceGain: 30
      });
      
      settings.cacheAggressiveness = Math.min(1.0, settings.cacheAggressiveness * 1.5);
    }
    
    return adjustments;
  }

  /**
   * Apply battery-aware optimizations
   * Requirement 9.4: Battery-aware processing optimization
   */
  private applyBatteryOptimizations(settings: QualitySettings, batteryLevel: number): QualityAdjustment[] {
    const adjustments: QualityAdjustment[] = [];
    
    if (batteryLevel < 0.1) {
      // Critical battery - aggressive power saving
      adjustments.push({
        component: 'parallelProcessing',
        originalValue: settings.parallelProcessing ? 1 : 0,
        adjustedValue: 0,
        reason: 'Critical battery level - disable parallel processing',
        impact: 'high',
        performanceGain: 40
      });
      
      adjustments.push({
        component: 'audioProcessingQuality',
        originalValue: settings.audioProcessingQuality,
        adjustedValue: Math.max(0.4, settings.audioProcessingQuality * 0.5),
        reason: 'Critical battery level - reduce processing quality',
        impact: 'high',
        performanceGain: 35
      });
      
      settings.parallelProcessing = false;
      settings.audioProcessingQuality = Math.max(0.4, settings.audioProcessingQuality * 0.5);
      
    } else if (batteryLevel < 0.2) {
      // Low battery - moderate power saving
      adjustments.push({
        component: 'audioProcessingQuality',
        originalValue: settings.audioProcessingQuality,
        adjustedValue: Math.max(0.6, settings.audioProcessingQuality * 0.7),
        reason: 'Low battery level - reduce processing quality',
        impact: 'medium',
        performanceGain: 20
      });
      
      settings.audioProcessingQuality = Math.max(0.6, settings.audioProcessingQuality * 0.7);
    }
    
    return adjustments;
  }

  /**
   * Analyze system load level
   */
  private analyzeSystemLoad(systemLoad: SystemLoadMetrics): 'low' | 'medium' | 'high' | 'critical' {
    const cpuLevel = systemLoad.cpuUsage;
    const memoryMB = systemLoad.memoryUsage / 1024 / 1024;
    const latencyLevel = systemLoad.networkLatency;
    
    if (cpuLevel > this.adaptationThresholds.cpu.critical || 
        memoryMB > this.adaptationThresholds.memory.critical ||
        latencyLevel > this.adaptationThresholds.latency.critical) {
      return 'critical';
    } else if (cpuLevel > this.adaptationThresholds.cpu.high || 
               memoryMB > this.adaptationThresholds.memory.high ||
               latencyLevel > this.adaptationThresholds.latency.high) {
      return 'high';
    } else if (cpuLevel > this.adaptationThresholds.cpu.medium || 
               memoryMB > this.adaptationThresholds.memory.medium ||
               latencyLevel > this.adaptationThresholds.latency.medium) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Analyze user context requirements
   */
  private analyzeUserContext(context: UserContext): {
    qualityImportance: number;
    speedImportance: number;
    reliabilityImportance: number;
  } {
    let qualityImportance = 0.5;
    let speedImportance = 0.5;
    let reliabilityImportance = 0.5;
    
    // Adjust based on mode
    switch (context.mode) {
      case 'interview':
        qualityImportance = 0.9;
        reliabilityImportance = 0.9;
        speedImportance = 0.6;
        break;
      case 'meeting':
        speedImportance = 0.8;
        reliabilityImportance = 0.7;
        qualityImportance = 0.6;
        break;
      case 'casual':
        speedImportance = 0.9;
        qualityImportance = 0.4;
        reliabilityImportance = 0.5;
        break;
      case 'presentation':
        qualityImportance = 0.8;
        reliabilityImportance = 0.9;
        speedImportance = 0.7;
        break;
    }
    
    // Adjust based on priority
    switch (context.priority) {
      case 'critical':
        qualityImportance *= 1.2;
        reliabilityImportance *= 1.2;
        break;
      case 'high':
        qualityImportance *= 1.1;
        reliabilityImportance *= 1.1;
        break;
      case 'low':
        speedImportance *= 1.2;
        break;
    }
    
    return {
      qualityImportance: Math.min(1.0, qualityImportance),
      speedImportance: Math.min(1.0, speedImportance),
      reliabilityImportance: Math.min(1.0, reliabilityImportance)
    };
  }

  /**
   * Calculate confidence in the adaptation decision
   */
  private calculateConfidence(
    systemLoad: SystemLoadMetrics, 
    userContext: UserContext, 
    adjustments: QualityAdjustment[]
  ): number {
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for extreme conditions
    if (systemLoad.cpuUsage > 0.9) confidence -= 0.2;
    if (systemLoad.memoryUsage / 1024 / 1024 > 500) confidence -= 0.2;
    if (systemLoad.networkLatency > 2000) confidence -= 0.2;
    
    // Increase confidence for familiar contexts
    const contextKey = `${userContext.mode}-${userContext.priority}`;
    if (this.userPreferences.has(contextKey)) {
      confidence += 0.1;
    }
    
    // Adjust based on number of adjustments
    if (adjustments.length > 5) confidence -= 0.1;
    if (adjustments.length === 0) confidence -= 0.3;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Calculate estimated performance gain
   */
  private calculatePerformanceGain(adjustments: QualityAdjustment[]): number {
    return adjustments.reduce((total, adj) => total + adj.performanceGain, 0);
  }

  /**
   * Record decision for learning
   */
  private recordDecision(decision: AdaptiveDecision): void {
    this.decisionHistory.push(decision);
    
    // Keep only last 100 decisions
    if (this.decisionHistory.length > 100) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Update user preferences based on context and adjustments
   * Requirement 9.2: User preference learning
   */
  private updateUserPreferences(context: UserContext, adjustments: QualityAdjustment[]): void {
    const contextKey = `${context.mode}-${context.priority}`;
    const adjustmentScore = adjustments.reduce((sum, adj) => sum + adj.performanceGain, 0);
    
    // Simple learning: track average adjustment scores for contexts
    const currentPreference = this.userPreferences.get(contextKey) || 0;
    const newPreference = (currentPreference * 0.8) + (adjustmentScore * 0.2);
    
    this.userPreferences.set(contextKey, newPreference);
  }

  /**
   * Get current quality settings
   */
  public getCurrentSettings(): QualitySettings {
    return { ...this.currentSettings };
  }

  /**
   * Get baseline settings
   */
  public getBaselineSettings(): QualitySettings {
    return { ...this.baselineSettings };
  }

  /**
   * Reset to baseline settings
   */
  public resetToBaseline(): void {
    this.currentSettings = { ...this.baselineSettings };
    console.log('[AdaptiveQualityManager] Reset to baseline settings');
    this.emit('settings-reset', this.currentSettings);
  }

  /**
   * Get decision history
   */
  public getDecisionHistory(limit?: number): AdaptiveDecision[] {
    return limit ? this.decisionHistory.slice(-limit) : [...this.decisionHistory];
  }

  /**
   * Get user preferences
   */
  public getUserPreferences(): Map<string, number> {
    return new Map(this.userPreferences);
  }

  /**
   * Enable or disable learning
   */
  public setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    console.log(`[AdaptiveQualityManager] Learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get adaptation statistics
   */
  public getAdaptationStats(): {
    totalDecisions: number;
    averageConfidence: number;
    averagePerformanceGain: number;
    mostCommonAdjustments: Array<{ component: string; count: number }>;
  } {
    if (this.decisionHistory.length === 0) {
      return {
        totalDecisions: 0,
        averageConfidence: 0,
        averagePerformanceGain: 0,
        mostCommonAdjustments: []
      };
    }
    
    const totalDecisions = this.decisionHistory.length;
    const averageConfidence = this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions;
    const averagePerformanceGain = this.decisionHistory.reduce((sum, d) => sum + d.estimatedPerformanceGain, 0) / totalDecisions;
    
    // Count adjustment types
    const adjustmentCounts = new Map<string, number>();
    this.decisionHistory.forEach(decision => {
      decision.adjustments.forEach(adj => {
        adjustmentCounts.set(adj.component, (adjustmentCounts.get(adj.component) || 0) + 1);
      });
    });
    
    const mostCommonAdjustments = Array.from(adjustmentCounts.entries())
      .map(([component, count]) => ({ component, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalDecisions,
      averageConfidence,
      averagePerformanceGain,
      mostCommonAdjustments
    };
  }
}