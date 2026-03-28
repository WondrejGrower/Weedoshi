import { logger } from './logger';
class Diagnostics {
    constructor() {
        Object.defineProperty(this, "logs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxLogs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 50
        });
        Object.defineProperty(this, "recentInfoLogs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "infoDedupWindowMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1500
        });
    }
    log(message, level = 'info') {
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
    getLogs() {
        return [...this.logs];
    }
    clearLogs() {
        this.logs = [];
    }
    getLastError() {
        const errorLogs = this.logs.filter(log => log.includes('[ERROR]'));
        return errorLogs.length > 0 ? errorLogs[errorLogs.length - 1] : null;
    }
}
export const diagnostics = new Diagnostics();
