import type { Event } from 'nostr-tools';
import { verifyEvent } from 'nostr-tools';
import { diagnostics } from './diagnostics';

/**
 * EventValidator ensures all events are cryptographically valid
 * and haven't been tampered with.
 */
export class EventValidator {
  private invalidCount: number = 0;
  private validCount: number = 0;

  /**
   * Validate a Nostr event
   * @param event - The event to validate
   * @returns true if valid, false if invalid
   */
  validateEvent(event: Event): boolean {
    try {
      // 1. Verify cryptographic signature
      const signatureValid = verifyEvent(event);
      if (!signatureValid) {
        this.invalidCount++;
        diagnostics.log(
          `❌ Invalid signature for event ${event.id.substring(0, 8)}...`,
          'error'
        );
        return false;
      }

      // 2. Verify timestamp is reasonable (not too far in future/past)
      const now = Math.floor(Date.now() / 1000);
      const oneDayInSeconds = 86400;

      // Warn if timestamp is more than 1 day in the future
      if (event.created_at > now + oneDayInSeconds) {
        diagnostics.log(
          `⚠️ Event ${event.id.substring(0, 8)}... has suspicious future timestamp`,
          'warn'
        );
        // Still accept, but log warning
      }

      // Reject if timestamp is more than 30 days old (configurable)
      const thirtyDaysInSeconds = oneDayInSeconds * 30;
      if (event.created_at < now - thirtyDaysInSeconds) {
        diagnostics.log(
          `⚠️ Event ${event.id.substring(0, 8)}... is very old (>30 days)`,
          'warn'
        );
        // Still accept, but log warning
      }

      // 3. Basic content validation
      if (event.kind === 1 && event.content.length > 50000) {
        diagnostics.log(
          `⚠️ Event ${event.id.substring(0, 8)}... has suspiciously long content (${event.content.length} chars)`,
          'warn'
        );
      }

      this.validCount++;
      // Log stats periodically
      if ((this.validCount + this.invalidCount) % 100 === 0) {
        diagnostics.log(
          `Event validation: ${this.validCount} valid, ${this.invalidCount} invalid`,
          'info'
        );
      }

      return true;
    } catch (error) {
      this.invalidCount++;
      diagnostics.log(
        `❌ Event validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
      return false;
    }
  }

  /**
   * Get validation statistics
   */
  getStats() {
    const total = this.validCount + this.invalidCount;
    return {
      validEvents: this.validCount,
      invalidEvents: this.invalidCount,
      totalProcessed: total,
      validRate: total > 0 ? ((this.validCount / total) * 100).toFixed(1) + '%' : '100%',
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.validCount = 0;
    this.invalidCount = 0;
    diagnostics.log('Event validator stats reset', 'info');
  }
}

// Singleton instance
export const eventValidator = new EventValidator();