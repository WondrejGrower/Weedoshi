import { sanitizeForLogs } from './securityBaseline';
const isDevRuntime = () => {
    const globalDevFlag = globalThis.__DEV__;
    return typeof globalDevFlag === 'boolean' ? globalDevFlag : true;
};
function safeArgs(args) {
    return args.map((arg) => sanitizeForLogs(arg));
}
export const logger = {
    info: (...args) => {
        if (isDevRuntime()) {
            // eslint-disable-next-line no-console
            console.log(...safeArgs(args));
        }
    },
    warn: (...args) => {
        console.warn(...safeArgs(args));
    },
    error: (...args) => {
        console.error(...safeArgs(args));
    },
};
