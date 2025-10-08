import { ipcMain, BrowserWindow } from 'electron';
import { PerformanceMonitor, PerformanceMetrics, PerformanceAlert } from './PerformanceMonitor';

export class PerformanceIpcHandlers {
  private performanceMonitor: PerformanceMonitor;
  private mainWindow: BrowserWindow | null = null;

  constructor(performanceMonitor: PerformanceMonitor) {
    this.performanceMonitor = performanceMonitor;
    this.setupIpcHandlers();
    this.setupEventForwarding();
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupIpcHandlers(): void {
    // Get current performance metrics
    ipcMain.handle('performance:get-metrics', async (): Promise<PerformanceMetrics> => {
      return this.performanceMonitor.getMetrics();
    });

    // Get performance metrics history
    ipcMain.handle('performance:get-metrics-history', async (_, limit?: number): Promise<PerformanceMetrics[]> => {
      return this.performanceMonitor.getMetricsHistory(limit);
    });

    // Get current alerts
    ipcMain.handle('performance:get-alerts', async (): Promise<PerformanceAlert[]> => {
      return this.performanceMonitor.getAlerts();
    });

    // Clear alerts
    ipcMain.handle('performance:clear-alerts', async (_, olderThan?: number): Promise<void> => {
      this.performanceMonitor.clearAlerts(olderThan);
    });

    // Start monitoring
    ipcMain.handle('performance:start-monitoring', async (): Promise<void> => {
      this.performanceMonitor.startMonitoring();
    });

    // Stop monitoring
    ipcMain.handle('performance:stop-monitoring', async (): Promise<void> => {
      this.performanceMonitor.stopMonitoring();
    });

    // Generate performance report
    ipcMain.handle('performance:generate-report', async () => {
      return this.performanceMonitor.generateReport();
    });

    // Record custom metric
    ipcMain.handle('performance:record-metric', async (_, category: keyof PerformanceMetrics, metric: string, value: number): Promise<void> => {
      this.performanceMonitor.recordMetric(category, metric, value);
    });

    // Start timing operation
    ipcMain.handle('performance:start-timing', async (_, operationId: string, operation: string, metadata?: Record<string, any>): Promise<void> => {
      this.performanceMonitor.startTiming(operationId, operation, metadata);
    });

    // End timing operation
    ipcMain.handle('performance:end-timing', async (_, operationId: string): Promise<number | null> => {
      return this.performanceMonitor.endTiming(operationId);
    });

    // Record cache hit/miss
    ipcMain.handle('performance:record-cache-hit', async (_, isHit: boolean): Promise<void> => {
      this.performanceMonitor.recordCacheHit(isHit);
    });

    console.log('[PerformanceIpcHandlers] IPC handlers registered');
  }

  private setupEventForwarding(): void {
    // Forward performance events to renderer process
    this.performanceMonitor.on('metrics-updated', (metrics: PerformanceMetrics) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('performance:metrics-updated', metrics);
      }
    });

    this.performanceMonitor.on('alert', (alert: PerformanceAlert) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('performance:alert', alert);
      }
    });

    this.performanceMonitor.on('metric-recorded', (data: { category: string; metric: string; value: number }) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('performance:metric-recorded', data);
      }
    });

    console.log('[PerformanceIpcHandlers] Event forwarding setup complete');
  }

  public cleanup(): void {
    // Remove all IPC handlers
    ipcMain.removeHandler('performance:get-metrics');
    ipcMain.removeHandler('performance:get-metrics-history');
    ipcMain.removeHandler('performance:get-alerts');
    ipcMain.removeHandler('performance:clear-alerts');
    ipcMain.removeHandler('performance:start-monitoring');
    ipcMain.removeHandler('performance:stop-monitoring');
    ipcMain.removeHandler('performance:generate-report');
    ipcMain.removeHandler('performance:record-metric');
    ipcMain.removeHandler('performance:start-timing');
    ipcMain.removeHandler('performance:end-timing');
    ipcMain.removeHandler('performance:record-cache-hit');

    // Remove event listeners
    this.performanceMonitor.removeAllListeners('metrics-updated');
    this.performanceMonitor.removeAllListeners('alert');
    this.performanceMonitor.removeAllListeners('metric-recorded');

    console.log('[PerformanceIpcHandlers] Cleanup complete');
  }
}