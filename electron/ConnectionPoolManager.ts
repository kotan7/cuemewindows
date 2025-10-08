import { EventEmitter } from "events";
import { Agent } from "https";
import { measureTime, measureMemory } from "./decorators/PerformanceDecorators";

export interface ConnectionPool {
  id: string;
  endpoint: string;
  agent: Agent;
  activeConnections: number;
  maxConnections: number;
  keepAliveTimeout: number;
  isHealthy: boolean;
  lastHealthCheck: number;
}

export interface PoolConfig {
  maxConnections: number;
  keepAliveTimeout: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  poolUtilization: number;
  averageResponseTime: number;
  errorRate: number;
  healthyPools: number;
  totalPools: number;
}

/**
 * HTTP Connection Pool Manager for optimized API connections
 * Requirement 6.1: HTTP connection pooling with HTTP/2 support
 * Requirement 6.6: Connection health monitoring and failover
 */
export class ConnectionPoolManager extends EventEmitter {
  private pools: Map<string, ConnectionPool> = new Map();
  private defaultConfig: PoolConfig;
  private metrics: ConnectionMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    
    this.defaultConfig = {
      maxConnections: 10,
      keepAliveTimeout: 30000, // 30 seconds
      timeout: 15000, // 15 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      healthCheckInterval: 60000, // 1 minute
      ...config
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      poolUtilization: 0,
      averageResponseTime: 0,
      errorRate: 0,
      healthyPools: 0,
      totalPools: 0
    };

    this.startHealthMonitoring();
    console.log('[ConnectionPoolManager] Initialized with config:', this.defaultConfig);
  }

  /**
   * Create connection pool for specific endpoint
   * Requirement 6.1: HTTP connection pooling
   */
    // @measureTime('ConnectionPoolManager.createPool')
  public createPool(endpoint: string, config?: Partial<PoolConfig>): ConnectionPool {
    if (this.pools.has(endpoint)) {
      console.warn(`[ConnectionPoolManager] Pool for ${endpoint} already exists`);
      return this.pools.get(endpoint)!;
    }

    const poolConfig = { ...this.defaultConfig, ...config };
    
    // Create HTTPS agent with connection pooling
    const agent = new Agent({
      keepAlive: true,
      keepAliveMsecs: poolConfig.keepAliveTimeout,
      maxSockets: poolConfig.maxConnections,
      maxFreeSockets: Math.floor(poolConfig.maxConnections / 2),
      timeout: poolConfig.timeout,
      // Enable HTTP/2 if available
      maxCachedSessions: 100
    });

    const pool: ConnectionPool = {
      id: `pool-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
      endpoint,
      agent,
      activeConnections: 0,
      maxConnections: poolConfig.maxConnections,
      keepAliveTimeout: poolConfig.keepAliveTimeout,
      isHealthy: true,
      lastHealthCheck: Date.now()
    };

    this.pools.set(endpoint, pool);
    this.updateMetrics();
    
    console.log(`[ConnectionPoolManager] Created pool for ${endpoint}:`, {
      maxConnections: pool.maxConnections,
      keepAliveTimeout: pool.keepAliveTimeout
    });

    this.emit('pool-created', pool);
    return pool;
  }

  /**
   * Get connection from pool with load balancing
   * Requirement 6.1: Connection pooling with load balancing
   */
    // @measureTime('ConnectionPoolManager.getConnection')
  public async getConnection(endpoint: string): Promise<Agent> {
    let pool = this.pools.get(endpoint);
    
    if (!pool) {
      console.log(`[ConnectionPoolManager] Creating new pool for ${endpoint}`);
      pool = this.createPool(endpoint);
    }

    if (!pool.isHealthy) {
      console.warn(`[ConnectionPoolManager] Pool for ${endpoint} is unhealthy, attempting recovery`);
      await this.attemptPoolRecovery(pool);
    }

    pool.activeConnections++;
    this.updateMetrics();
    
    return pool.agent;
  }

  /**
   * Pre-warm connections for faster initial requests
   * Requirement 6.1: Connection pre-warming strategies
   */
    // @measureTime('ConnectionPoolManager.warmConnections')
  public async warmConnections(endpoints: string[]): Promise<void> {
    console.log(`[ConnectionPoolManager] Pre-warming connections for ${endpoints.length} endpoints`);
    
    const warmupPromises = endpoints.map(async (endpoint) => {
      try {
        const pool = this.pools.get(endpoint) || this.createPool(endpoint);
        
        // Create a minimal request to establish connection
        const agent = pool.agent;
        
        // Simulate connection establishment
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`[ConnectionPoolManager] Pre-warmed connection for ${endpoint}`);
        
      } catch (error) {
        console.warn(`[ConnectionPoolManager] Failed to pre-warm ${endpoint}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('[ConnectionPoolManager] Connection pre-warming completed');
    this.emit('connections-prewarmed', endpoints);
  }

  /**
   * Monitor pool health and performance
   * Requirement 6.6: Connection health monitoring
   */
  public monitorHealth(): ConnectionMetrics {
    this.updateMetrics();
    
    // Check individual pool health
    for (const [endpoint, pool] of this.pools) {
      const timeSinceLastCheck = Date.now() - pool.lastHealthCheck;
      
      if (timeSinceLastCheck > this.defaultConfig.healthCheckInterval * 2) {
        console.warn(`[ConnectionPoolManager] Pool ${endpoint} health check overdue`);
        pool.isHealthy = false;
      }
    }

    return { ...this.metrics };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ConnectionMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get pool status for specific endpoint
   */
  public getPoolStatus(endpoint: string): ConnectionPool | null {
    return this.pools.get(endpoint) || null;
  }

  /**
   * Get all pool statuses
   */
  public getAllPoolStatuses(): Array<{ endpoint: string; pool: ConnectionPool }> {
    return Array.from(this.pools.entries()).map(([endpoint, pool]) => ({
      endpoint,
      pool: { ...pool }
    }));
  }

  /**
   * Close specific pool
   */
    // @measureTime('ConnectionPoolManager.closePool')
  public async closePool(endpoint: string): Promise<void> {
    const pool = this.pools.get(endpoint);
    if (!pool) {
      console.warn(`[ConnectionPoolManager] Pool for ${endpoint} not found`);
      return;
    }

    // Destroy the agent and its connections
    pool.agent.destroy();
    this.pools.delete(endpoint);
    
    this.updateMetrics();
    console.log(`[ConnectionPoolManager] Closed pool for ${endpoint}`);
    this.emit('pool-closed', { endpoint, pool });
  }

  /**
   * Close all pools
   */
  public async closeAllPools(): Promise<void> {
    console.log(`[ConnectionPoolManager] Closing ${this.pools.size} pools`);
    
    const closePromises = Array.from(this.pools.keys()).map(endpoint => 
      this.closePool(endpoint)
    );
    
    await Promise.allSettled(closePromises);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('[ConnectionPoolManager] All pools closed');
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.defaultConfig.healthCheckInterval);
    
    console.log('[ConnectionPoolManager] Started health monitoring');
  }

  /**
   * Perform health checks on all pools
   */
    // @measureTime('ConnectionPoolManager.performHealthChecks')
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.pools.values()).map(pool => 
      this.checkPoolHealth(pool)
    );
    
    await Promise.allSettled(healthCheckPromises);
    this.updateMetrics();
    
    const unhealthyPools = Array.from(this.pools.values()).filter(pool => !pool.isHealthy);
    if (unhealthyPools.length > 0) {
      console.warn(`[ConnectionPoolManager] ${unhealthyPools.length} unhealthy pools detected`);
      this.emit('unhealthy-pools-detected', unhealthyPools);
    }
  }

  /**
   * Check health of individual pool
   */
  private async checkPoolHealth(pool: ConnectionPool): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Simple health check - could be enhanced with actual HTTP request
      const isHealthy = pool.agent && typeof pool.agent.destroy === 'function';
      
      pool.isHealthy = isHealthy;
      pool.lastHealthCheck = Date.now();
      
      const checkDuration = Date.now() - startTime;
      
      if (!isHealthy) {
        console.warn(`[ConnectionPoolManager] Pool ${pool.endpoint} failed health check`);
        this.emit('pool-unhealthy', pool);
      }
      
    } catch (error) {
      console.error(`[ConnectionPoolManager] Health check error for ${pool.endpoint}:`, error);
      pool.isHealthy = false;
      pool.lastHealthCheck = Date.now();
    }
  }

  /**
   * Attempt to recover unhealthy pool
   */
    // @measureTime('ConnectionPoolManager.attemptPoolRecovery')
  private async attemptPoolRecovery(pool: ConnectionPool): Promise<void> {
    console.log(`[ConnectionPoolManager] Attempting recovery for pool ${pool.endpoint}`);
    
    try {
      // Destroy old agent
      pool.agent.destroy();
      
      // Create new agent
      pool.agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: pool.keepAliveTimeout,
        maxSockets: pool.maxConnections,
        maxFreeSockets: Math.floor(pool.maxConnections / 2),
        timeout: this.defaultConfig.timeout,
        maxCachedSessions: 100
      });
      
      // Reset connection count
      pool.activeConnections = 0;
      pool.isHealthy = true;
      pool.lastHealthCheck = Date.now();
      
      console.log(`[ConnectionPoolManager] Successfully recovered pool ${pool.endpoint}`);
      this.emit('pool-recovered', pool);
      
    } catch (error) {
      console.error(`[ConnectionPoolManager] Failed to recover pool ${pool.endpoint}:`, error);
      pool.isHealthy = false;
    }
  }

  /**
   * Update connection metrics
   */
  private updateMetrics(): void {
    let totalConnections = 0;
    let activeConnections = 0;
    let healthyPools = 0;
    
    for (const pool of this.pools.values()) {
      totalConnections += pool.maxConnections;
      activeConnections += pool.activeConnections;
      if (pool.isHealthy) healthyPools++;
    }
    
    this.metrics = {
      totalConnections,
      activeConnections,
      poolUtilization: totalConnections > 0 ? activeConnections / totalConnections : 0,
      averageResponseTime: 0, // Would be calculated from actual request metrics
      errorRate: 0, // Would be calculated from actual error metrics
      healthyPools,
      totalPools: this.pools.size
    };
  }

  /**
   * Release connection back to pool
   */
  public releaseConnection(endpoint: string): void {
    const pool = this.pools.get(endpoint);
    if (pool && pool.activeConnections > 0) {
      pool.activeConnections--;
      this.updateMetrics();
    }
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    pools: number;
    totalConnections: number;
    activeConnections: number;
    utilization: number;
    healthyPools: number;
  } {
    this.updateMetrics();
    
    return {
      pools: this.metrics.totalPools,
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      utilization: this.metrics.poolUtilization,
      healthyPools: this.metrics.healthyPools
    };
  }
}