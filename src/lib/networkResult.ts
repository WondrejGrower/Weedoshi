export interface PublishDiagnostic {
  relay: string;
  success: boolean;
  message?: string;
  prefix?: string;
}

export interface PublishSummary {
  successCount: number;
  failureCount: number;
  diagnostics: PublishDiagnostic[];
}

/**
 * Parses NIP-20 / NIP-01 "OK" / "CLOSED" prefixes from relay messages.
 * e.g., "pow: difficulty 20 too low" -> "pow"
 */
export function parseNip20Prefix(message: string): string | undefined {
  const normalized = message.trim().toLowerCase();
  const prefixes = [
    'pow:',
    'duplicate:',
    'blocked:',
    'rate-limited:',
    'invalid:',
    'error:',
    'restricted:',
    'auth-required:',
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      return prefix.slice(0, -1);
    }
  }
  return undefined;
}

export async function requireAtLeastOneSuccess(
  tasks: Promise<unknown>[],
  failureMessage: string
): Promise<{ successCount: number; failureCount: number }> {
  const results = await Promise.allSettled(tasks);
  const successCount = results.filter((result) => result.status === 'fulfilled').length;
  const failureCount = results.length - successCount;

  if (successCount === 0) {
    const firstRejected = results.find((result) => result.status === 'rejected');
    const reason =
      firstRejected && firstRejected.status === 'rejected'
        ? firstRejected.reason instanceof Error
          ? firstRejected.reason.message
          : String(firstRejected.reason)
        : 'Unknown publish error';

    throw new Error(`${failureMessage}: ${reason}`);
  }

  return { successCount, failureCount };
}

/**
 * Enhanced version of requireAtLeastOneSuccess that maps relay responses
 * into structured diagnostics (NIP-20 support).
 */
export async function publishWithDiagnostics(
  publishPromises: Promise<string>[],
  relayUrls: string[],
  failureMessage: string
): Promise<PublishSummary> {
  const results = await Promise.allSettled(publishPromises);
  
  const diagnostics: PublishDiagnostic[] = results.map((result, idx) => {
    const relay = relayUrls[idx] || 'unknown';
    if (result.status === 'fulfilled') {
      return { relay, success: true };
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const prefix = parseNip20Prefix(message);
      return { relay, success: false, message, prefix };
    }
  });

  const successCount = diagnostics.filter((d) => d.success).length;
  const failureCount = diagnostics.length - successCount;

  if (successCount === 0) {
    const firstFailure = diagnostics.find((d) => !d.success);
    const reason = firstFailure?.message || 'Unknown publish error';
    throw new Error(`${failureMessage}: ${reason}`);
  }

  return { successCount, failureCount, diagnostics };
}
