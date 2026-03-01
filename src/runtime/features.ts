import type { RuntimeMode } from './mode';

export type Features = {
  allowNsecLogin: boolean;
  allowFileSystem: boolean;
  allowNativeShare: boolean;
  requireBrowserSigner: boolean;
};

export function getFeatures(mode: RuntimeMode): Features {
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
