/**
 * Converts a caught exception into a plain error-like object. The result is
 * guaranteed to be free of circular references or properties that cannot be
 * structurally cloned, and can be safely transferred via postMessage or
 * WebSocket.
 */
export function errorToJson(error: unknown): Error {
    if (!(error instanceof Error)) {
        return { name: 'Error', message: String(error ?? '') };
    }

    let errorProps: Record<string, unknown>;
    try {
        errorProps = JSON.parse(JSON.stringify(error));
    } catch {
        errorProps = {};
    }

    return {
        ...errorProps,

        // Non-enumerable properties
        name: String(error.name),
        message: String(error.message),
        stack: error.stack ? String(error.stack) : undefined,
        cause: error.cause ? errorToJson(error.cause) : undefined,
    };
}
