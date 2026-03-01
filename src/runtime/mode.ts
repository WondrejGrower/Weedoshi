export type RuntimeMode = 'web' | 'app';

const WEB_HOSTS = new Set(['weedoshi.to', 'www.weedoshi.to']);

function normalizeMode(value: unknown): RuntimeMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'web' || normalized === 'app') {
    return normalized;
  }
  return null;
}

function getEnvOverride(): RuntimeMode | null {
  const env = (globalThis as any)?.process?.env ?? {};
  const envCandidates: unknown[] = [
    env.APP_MODE,
    env.VITE_APP_MODE,
    env.NEXT_PUBLIC_APP_MODE,
    env.EXPO_PUBLIC_APP_MODE,
    (globalThis as any)?.APP_MODE,
  ];

  for (const candidate of envCandidates) {
    const mode = normalizeMode(candidate);
    if (mode) return mode;
  }

  return null;
}

function getBrowserHostname(): string | null {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return null;
  }
  return window.location.hostname.toLowerCase();
}

function isNativeWrapper(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(win.__TAURI__ || win.Capacitor);
}

export function getRuntimeMode(): RuntimeMode {
  const hostname = getBrowserHostname();
  if (hostname && WEB_HOSTS.has(hostname)) {
    return 'web';
  }

  const overrideMode = getEnvOverride();
  if (overrideMode) {
    return overrideMode;
  }

  if (isNativeWrapper()) {
    return 'app';
  }

  return 'app';
}
