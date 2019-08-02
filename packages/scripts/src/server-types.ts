export interface ServerResponse {
    result: 'success' | 'error';
}

export interface ErrorResponse extends ServerResponse {
    result: 'error';
    error: string;
}

export interface SuccessResponse extends ServerResponse {
    result: 'success';
}

export interface ListNodeEnvironmentsResponse extends SuccessResponse {
    data?: string[] | Record<string, string[]>;
}

export const isServerResponseMessage = (message: unknown): message is ServerResponse => {
    if (message && typeof message === 'object') {
        const result = (message as Record<string, unknown>).result;
        if (typeof result === 'string') {
            return ['success', 'error'].includes(result);
        }
    }
    return false;
};

export const isSuccessResponse = (message: unknown): message is SuccessResponse =>
    isServerResponseMessage(message) && message.result === 'success';

export const isErrorResponse = (message: unknown): message is ErrorResponse =>
    isServerResponseMessage(message) && message.result === 'error';
