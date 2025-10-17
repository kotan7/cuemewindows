/**
 * Node.js wrapper for Windows Audio Capture
 * Provides a JavaScript interface to the PowerShell audio capture script
 * 
 * Usage:
 * const capture = new WindowsAudioCapture();
 * await capture.getStatus();
 * await capture.startCapture();
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class WindowsAudioCapture {
  constructor() {
    this.process = null;
    this.scriptPath = this._findPowerShellScript();
    this.isCapturing = false;
    this.eventHandlers = {
      'audio-data': [],
      'status': [],
      'error': [],
      'info': []
    };
  }

  /**
   * Find the PowerShell script location
   */
  _findPowerShellScript() {
    // Try different locations based on dev vs production
    const possiblePaths = [
      path.join(__dirname, 'WindowsAudioCapture.ps1'),
      path.join(process.cwd(), 'dist-native', 'WindowsAudioCapture.ps1'),
      path.join(process.resourcesPath || '', 'dist-native', 'WindowsAudioCapture.ps1')
    ];

    for (const scriptPath of possiblePaths) {
      if (fs.existsSync(scriptPath)) {
        return scriptPath;
      }
    }

    throw new Error('WindowsAudioCapture.ps1 not found');
  }

  /**
   * Execute PowerShell command
   */
  async _executePowerShell(command, args = []) {
    return new Promise((resolve, reject) => {
      const psArgs = [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', this.scriptPath,
        '-Command', command,
        ...args
      ];

      const process = spawn('powershell.exe', psArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let hasResponded = false;

      const timeout = setTimeout(() => {
        if (!hasResponded) {
          process.kill();
          hasResponded = true;
          reject(new Error('PowerShell command timeout'));
        }
      }, 5000);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Parse real-time output
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('STATUS_DATA:')) {
            try {
              const jsonStr = line.substring('STATUS_DATA:'.length).trim();
              const statusData = JSON.parse(jsonStr);
              
              if (!hasResponded) {
                clearTimeout(timeout);
                hasResponded = true;
                resolve(statusData);
              }
            } catch (err) {
              // Ignore parse errors, wait for complete data
            }
          } else if (line.startsWith('PERMISSION_RESULT:')) {
            try {
              const jsonStr = line.substring('PERMISSION_RESULT:'.length).trim();
              const result = JSON.parse(jsonStr);
              
              if (!hasResponded) {
                clearTimeout(timeout);
                hasResponded = true;
                resolve(result);
              }
            } catch (err) {
              // Ignore parse errors
            }
          }
        }
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (!hasResponded) {
          clearTimeout(timeout);
          hasResponded = true;
          
          if (code === 0) {
            resolve({ stdout, stderr, code });
          } else {
            reject(new Error(`PowerShell exited with code ${code}: ${stderr}`));
          }
        }
      });

      process.on('error', (error) => {
        if (!hasResponded) {
          clearTimeout(timeout);
          hasResponded = true;
          reject(error);
        }
      });
    });
  }

  /**
   * Get audio system status
   */
  async getStatus() {
    try {
      const status = await this._executePowerShell('status');
      return status;
    } catch (error) {
      throw new Error(`Failed to get audio status: ${error.message}`);
    }
  }

  /**
   * Check if system audio is available
   */
  async isAvailable() {
    try {
      const status = await this.getStatus();
      return status.isAvailable === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Request audio permissions (mostly a check on Windows)
   */
  async requestPermissions() {
    try {
      const result = await this._executePowerShell('permissions');
      return result;
    } catch (error) {
      return {
        granted: false,
        error: error.message
      };
    }
  }

  /**
   * Start audio capture
   */
  async startCapture() {
    if (this.isCapturing) {
      throw new Error('Already capturing');
    }

    return new Promise((resolve, reject) => {
      const psArgs = [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', this.scriptPath,
        '-Command', 'start'
      ];

      this.process = spawn('powershell.exe', psArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let isReady = false;

      const readyTimeout = setTimeout(() => {
        if (!isReady) {
          this.stopCapture();
          reject(new Error('Audio capture initialization timeout'));
        }
      }, 10000);

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('STATUS: READY')) {
            if (!isReady) {
              clearTimeout(readyTimeout);
              isReady = true;
              this.isCapturing = true;
              resolve();
            }
          } else if (trimmed.startsWith('AUDIO_DATA:')) {
            this._emit('audio-data', trimmed.substring('AUDIO_DATA:'.length).trim());
          } else if (trimmed.startsWith('STATUS:')) {
            this._emit('status', trimmed.substring('STATUS:'.length).trim());
          } else if (trimmed.startsWith('INFO:')) {
            this._emit('info', trimmed.substring('INFO:'.length).trim());
          } else if (trimmed.startsWith('ERROR:')) {
            this._emit('error', new Error(trimmed.substring('ERROR:'.length).trim()));
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        this._emit('error', new Error(data.toString()));
      });

      this.process.on('close', (code) => {
        this.isCapturing = false;
        this.process = null;
        
        if (!isReady) {
          clearTimeout(readyTimeout);
          reject(new Error(`PowerShell process exited with code ${code}`));
        }
      });

      this.process.on('error', (error) => {
        this.isCapturing = false;
        this.process = null;
        
        if (!isReady) {
          clearTimeout(readyTimeout);
          reject(error);
        } else {
          this._emit('error', error);
        }
      });
    });
  }

  /**
   * Stop audio capture
   */
  async stopCapture() {
    if (!this.process || !this.isCapturing) {
      return;
    }

    try {
      // Send stop command
      this.process.stdin.write('stop\n');
      this.process.stdin.write('quit\n');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force kill if still running
      if (this.process && !this.process.killed) {
        this.process.kill();
      }
    } catch (error) {
      // Force kill on error
      if (this.process && !this.process.killed) {
        this.process.kill();
      }
    }

    this.isCapturing = false;
    this.process = null;
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].push(handler);
    }
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopCapture();
    this.eventHandlers = {
      'audio-data': [],
      'status': [],
      'error': [],
      'info': []
    };
  }
}

module.exports = WindowsAudioCapture;
