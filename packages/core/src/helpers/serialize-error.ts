export function serializeError(error: unknown): Error {
    if (error instanceof Error) {
        const { name, message, stack, ...extra } = error;
        return {
            // Since we don't know the type of the extra properties, we need to stringify the them to make sure it can go through postMessage
            ...JSON.parse(JSON.stringify(extra)),
            // Non-enumerable properties, can't be added via spread
            name,
            message,
            stack,
        };
    }
    return {
        name: 'Error',
        message: typeof error === 'string' ? error : JSON.stringify(error),
    };
}
