/**
 * Converts a caught exception into a plain error-like object. The result is
 * guaranteed to be free of circular references or properties that cannot be
 * structurally cloned, and can be safely transferred via postMessage or
 * WebSocket.
 */
export function errorToJson(error: unknown): Error {
    try {
        if (!(error instanceof Error)) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
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
    } catch {
        return { name: 'Error', message: 'Failed to convert error to plain object' };
    }
}
