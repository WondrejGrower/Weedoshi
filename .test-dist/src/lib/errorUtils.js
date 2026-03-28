export function toErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
