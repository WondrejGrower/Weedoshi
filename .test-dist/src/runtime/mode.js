const WEB_HOSTS = new Set(['weedoshi.to', 'www.weedoshi.to']);
function normalizeMode(value) {
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'web' || normalized === 'app') {
        return normalized;
    }
    return null;
}
function getEnvOverride() {
    const env = globalThis?.process?.env ?? {};
    const envCandidates = [
        env.APP_MODE,
        env.VITE_APP_MODE,
        env.NEXT_PUBLIC_APP_MODE,
        env.EXPO_PUBLIC_APP_MODE,
        globalThis?.APP_MODE,
    ];
    for (const candidate of envCandidates) {
        const mode = normalizeMode(candidate);
        if (mode)
            return mode;
    }
    return null;
}
function getBrowserHostname() {
    if (typeof window === 'undefined' || !window.location?.hostname) {
        return null;
    }
    return window.location.hostname.toLowerCase();
}
function isNativeWrapper() {
    if (typeof window === 'undefined')
        return false;
    const win = window;
    return Boolean(win.__TAURI__ || win.Capacitor);
}
export function getRuntimeMode() {
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
