export function serializeError(error: unknown): Error {
    if (error instanceof Error) {
        return {
            // Custom properties
            ...error,
            // Non-enumerable properties, can't be added via spread
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }
    return {
        name: 'Error',
        message: typeof error === 'string' ? error : JSON.stringify(error),
    };
}
