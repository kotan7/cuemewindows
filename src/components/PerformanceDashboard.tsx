import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/card';

interface PerformanceMetrics {
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

interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'latency' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
}

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isVisible, onClose }) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Format bytes to human readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format milliseconds to human readable format
  const formatMs = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format percentage
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Get status color based on value and thresholds
  const getStatusColor = (value: number, thresholds: { good: number; warning: number; critical: number }): string => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    if (value <= thresholds.critical) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get alert severity color
  const getAlertColor = (severity: string): string => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'critical': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Request performance metrics from main process
  const requestMetrics = useCallback(() => {
    if (window.electronAPI?.performance) {
      window.electronAPI.performance.getMetrics()
        .then((data: PerformanceMetrics) => {
          setMetrics(data);
        })
        .catch((error: Error) => {
          console.error('Failed to get performance metrics:', error);
        });
    }
  }, []);

  // Request performance alerts from main process
  const requestAlerts = useCallback(() => {
    if (window.electronAPI?.performance) {
      window.electronAPI.performance.getAlerts()
        .then((data: PerformanceAlert[]) => {
          setAlerts(data);
        })
        .catch((error: Error) => {
          console.error('Failed to get performance alerts:', error);
        });
    }
  }, []);

  // Start/stop monitoring
  const toggleMonitoring = useCallback(() => {
    if (window.electronAPI?.performance) {
      if (isMonitoring) {
        window.electronAPI.performance.stopMonitoring();
        setIsMonitoring(false);
      } else {
        window.electronAPI.performance.startMonitoring();
        setIsMonitoring(true);
      }
    }
  }, [isMonitoring]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    if (window.electronAPI?.performance) {
      window.electronAPI.performance.clearAlerts();
      setAlerts([]);
    }
  }, []);

  // Setup event listeners and polling
  useEffect(() => {
    if (!isVisible) return;

    // Initial data fetch
    requestMetrics();
    requestAlerts();

    // Setup polling for real-time updates
    const metricsInterval = setInterval(requestMetrics, 1000);
    const alertsInterval = setInterval(requestAlerts, 5000);

    // Setup event listeners for real-time updates
    const handleMetricsUpdate = (data: PerformanceMetrics) => {
      setMetrics(data);
    };

    const handleAlert = (alert: PerformanceAlert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 19)]); // Keep last 20 alerts
    };

    if (window.electronAPI?.performance) {
      window.electronAPI.performance.onMetricsUpdate(handleMetricsUpdate);
      window.electronAPI.performance.onAlert(handleAlert);
    }

    return () => {
      clearInterval(metricsInterval);
      clearInterval(alertsInterval);
      
      if (window.electronAPI?.performance) {
        window.electronAPI.performance.removeMetricsListener(handleMetricsUpdate);
        window.electronAPI.performance.removeAlertListener(handleAlert);
      }
    };
  }, [isVisible, requestMetrics, requestAlerts]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto m-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
            <div className="flex gap-2">
              <button
                onClick={toggleMonitoring}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isMonitoring 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>

          {metrics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Audio Processing Metrics */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">Audio Processing</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chunk Processing:</span>
                    <span className={getStatusColor(metrics.audioProcessing.chunkProcessingTime, { good: 200, warning: 350, critical: 500 })}>
                      {formatMs(metrics.audioProcessing.chunkProcessingTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transcription Latency:</span>
                    <span className={getStatusColor(metrics.audioProcessing.transcriptionLatency, { good: 1000, warning: 2000, critical: 3000 })}>
                      {formatMs(metrics.audioProcessing.transcriptionLatency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Question Detection:</span>
                    <span className={getStatusColor(metrics.audioProcessing.questionDetectionTime, { good: 50, warning: 75, critical: 100 })}>
                      {formatMs(metrics.audioProcessing.questionDetectionTime)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* LLM Processing Metrics */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">LLM Processing</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Generation:</span>
                    <span className={getStatusColor(metrics.llmProcessing.responseGenerationTime, { good: 1000, warning: 1500, critical: 2000 })}>
                      {formatMs(metrics.llmProcessing.responseGenerationTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">RAG Retrieval:</span>
                    <span className={getStatusColor(metrics.llmProcessing.ragRetrievalTime, { good: 200, warning: 500, critical: 1000 })}>
                      {formatMs(metrics.llmProcessing.ragRetrievalTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cache Hit Rate:</span>
                    <span className={getStatusColor(1 - metrics.llmProcessing.cacheHitRate, { good: 0.2, warning: 0.4, critical: 0.6 })}>
                      {formatPercent(metrics.llmProcessing.cacheHitRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Calls:</span>
                    <span className="text-gray-900">{metrics.llmProcessing.apiCallCount}</span>
                  </div>
                </div>
              </Card>

              {/* System Resources */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">System Resources</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Memory Usage:</span>
                    <span className={getStatusColor(metrics.systemResources.memoryUsage, { good: 100 * 1024 * 1024, warning: 200 * 1024 * 1024, critical: 400 * 1024 * 1024 })}>
                      {formatBytes(metrics.systemResources.memoryUsage)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heap Used:</span>
                    <span className="text-gray-900">{formatBytes(metrics.systemResources.heapUsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Heap Total:</span>
                    <span className="text-gray-900">{formatBytes(metrics.systemResources.heapTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPU Usage:</span>
                    <span className={getStatusColor(metrics.systemResources.cpuUsage, { good: 30, warning: 60, critical: 80 })}>
                      {formatPercent(metrics.systemResources.cpuUsage / 100)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* User Experience */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">User Experience</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">End-to-End Latency:</span>
                    <span className={getStatusColor(metrics.userExperience.endToEndLatency, { good: 2000, warning: 3000, critical: 5000 })}>
                      {formatMs(metrics.userExperience.endToEndLatency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error Rate:</span>
                    <span className={getStatusColor(metrics.userExperience.errorRate, { good: 0.01, warning: 0.05, critical: 0.1 })}>
                      {formatPercent(metrics.userExperience.errorRate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Accuracy Score:</span>
                    <span className="text-gray-900">{formatPercent(metrics.userExperience.accuracyScore)}</span>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading performance metrics...</p>
            </div>
          )}

          {/* Alerts Section */}
          {alerts.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
                <button
                  onClick={clearAlerts}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-md ${getAlertColor(alert.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium capitalize">{alert.severity}</span>
                        <span className="mx-2">•</span>
                        <span className="capitalize">{alert.type}</span>
                      </div>
                      <span className="text-xs">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};