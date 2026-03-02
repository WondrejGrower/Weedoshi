const NSEC_REGEX = /\bnsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi;
const HEX_PRIVKEY_REGEX = /\b[a-f0-9]{64}\b/gi;
const NCRYPTSEC_REGEX = /\bncryptsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi;
const SEED_HINT_REGEX = /\b(seed phrase|mnemonic|recovery phrase|backup phrase)\b/i;

type SensitiveCheck = {
  hasSensitive: boolean;
  reasons: string[];
};

function redactString(input: string): string {
  return input
    .replace(NSEC_REGEX, '[REDACTED_NSEC]')
    .replace(NCRYPTSEC_REGEX, '[REDACTED_NCRYPTSEC]')
    .replace(HEX_PRIVKEY_REGEX, '[REDACTED_HEX_SECRET]');
}

function looksLikeSeedPhrase(input: string): boolean {
  if (!SEED_HINT_REGEX.test(input)) {
    return false;
  }

  const normalized = input
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return normalized.length >= 12;
}

export function detectSensitiveMaterial(input: string): SensitiveCheck {
  const reasons: string[] = [];

  if (NSEC_REGEX.test(input)) {
    reasons.push('nsec');
  }
  if (NCRYPTSEC_REGEX.test(input)) {
    reasons.push('ncryptsec');
  }
  if (HEX_PRIVKEY_REGEX.test(input)) {
    reasons.push('hex-secret');
  }
  if (looksLikeSeedPhrase(input)) {
    reasons.push('seed-phrase');
  }

  return {
    hasSensitive: reasons.length > 0,
    reasons,
  };
}

export function assertNoSensitiveMaterial(input: string, fieldName: string): void {
  const check = detectSensitiveMaterial(input);
  if (!check.hasSensitive) return;

  throw new Error(
    `Blocked potential secret leak in ${fieldName} (${check.reasons.join(', ')})`
  );
}

export function sanitizeForLogs(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item));
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      sanitized[key] = sanitizeForLogs(val);
    }
    return sanitized;
  }

  return value;
}
