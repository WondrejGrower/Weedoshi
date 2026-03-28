const NSEC_REGEX = /\bnsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/i;
const HEX_PRIVKEY_REGEX = /\b[a-f0-9]{64}\b/i;
const NCRYPTSEC_REGEX = /\bncryptsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/i;
const SEED_HINT_REGEX = /\b(seed phrase|mnemonic|recovery phrase|backup phrase)\b/i;
const REDACT_NSEC_REGEX = /\bnsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi;
const REDACT_HEX_PRIVKEY_REGEX = /\b[a-f0-9]{64}\b/gi;
const REDACT_NCRYPTSEC_REGEX = /\bncryptsec1[023456789acdefghjklmnpqrstuvwxyz]{20,}\b/gi;
function redactString(input) {
    return input
        .replace(REDACT_NSEC_REGEX, '[REDACTED_NSEC]')
        .replace(REDACT_NCRYPTSEC_REGEX, '[REDACTED_NCRYPTSEC]')
        .replace(REDACT_HEX_PRIVKEY_REGEX, '[REDACTED_HEX_SECRET]');
}
function looksLikeSeedPhrase(input) {
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
export function detectSensitiveMaterial(input) {
    const reasons = [];
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
export function assertNoSensitiveMaterial(input, fieldName) {
    const check = detectSensitiveMaterial(input);
    if (!check.hasSensitive)
        return;
    throw new Error(`Blocked potential secret leak in ${fieldName} (${check.reasons.join(', ')})`);
}
export function sanitizeForLogs(value) {
    if (typeof value === 'string') {
        return redactString(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForLogs(item));
    }
    if (value && typeof value === 'object') {
        const obj = value;
        const sanitized = {};
        for (const [key, val] of Object.entries(obj)) {
            sanitized[key] = sanitizeForLogs(val);
        }
        return sanitized;
    }
    return value;
}
