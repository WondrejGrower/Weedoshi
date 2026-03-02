import { sanitizeForLogs } from './securityBaseline';

const isDevRuntime = () => {
  const globalDevFlag = (globalThis as { __DEV__?: boolean }).__DEV__;
  return typeof globalDevFlag === 'boolean' ? globalDevFlag : true;
};

function safeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => sanitizeForLogs(arg));
}

export const logger = {
  info: (...args: unknown[]) => {
    if (isDevRuntime()) {
      // eslint-disable-next-line no-console
      console.log(...safeArgs(args));
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...safeArgs(args));
  },
  error: (...args: unknown[]) => {
    console.error(...safeArgs(args));
  },
};
