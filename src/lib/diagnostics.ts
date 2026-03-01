/**
 * Diagnostics utility for debugging Nostr connections
 */

export interface DiagnosticsInfo {
  timestamp: string;
  relays: string[];
  connectionStatus: 'connecting' | 'connected' | 'timeout' | 'error';
  eventsReceived: number;
  errors: string[];
}

class Diagnostics {
  private logs: string[] = [];
  private maxLogs = 50;

  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Also log to console
    switch (level) {
      case 'error':
        console.error(logEntry);
        break;
      case 'warn':
        console.warn(logEntry);
        break;
      default:
        console.log(logEntry);
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  getLastError(): string | null {
    const errorLogs = this.logs.filter(log => log.includes('[ERROR]'));
    return errorLogs.length > 0 ? errorLogs[errorLogs.length - 1] : null;
  }
}

export const diagnostics = new Diagnostics();
