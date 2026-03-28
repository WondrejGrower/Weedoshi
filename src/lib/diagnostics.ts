import { logger } from './logger';

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
  private recentInfoLogs: Map<string, number> = new Map();
  private infoDedupWindowMs = 1500;

  log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    if (level === 'info') {
      const now = Date.now();
      const last = this.recentInfoLogs.get(message) || 0;
      if (now - last < this.infoDedupWindowMs) {
        return;
      }
      this.recentInfoLogs.set(message, now);
      if (this.recentInfoLogs.size > 200) {
        this.recentInfoLogs.clear();
      }
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Also log to console
    switch (level) {
      case 'error':
        logger.error(logEntry);
        break;
      case 'warn':
        logger.warn(logEntry);
        break;
      default:
        logger.info(logEntry);
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
