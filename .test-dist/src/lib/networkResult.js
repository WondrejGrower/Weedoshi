export async function requireAtLeastOneSuccess(tasks, failureMessage) {
    const results = await Promise.allSettled(tasks);
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;
    if (successCount === 0) {
        const firstRejected = results.find((result) => result.status === 'rejected');
        const reason = firstRejected && firstRejected.status === 'rejected'
            ? firstRejected.reason instanceof Error
                ? firstRejected.reason.message
                : String(firstRejected.reason)
            : 'Unknown publish error';
        throw new Error(`${failureMessage}: ${reason}`);
    }
    return { successCount, failureCount };
}
