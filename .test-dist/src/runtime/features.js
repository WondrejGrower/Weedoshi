export function getFeatures(mode) {
    if (mode === 'web') {
        return {
            allowNsecLogin: false,
            allowFileSystem: false,
            allowNativeShare: false,
            requireBrowserSigner: true,
        };
    }
    return {
        allowNsecLogin: true,
        allowFileSystem: true,
        allowNativeShare: true,
        requireBrowserSigner: false,
    };
}
