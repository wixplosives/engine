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
    data?: string[];
}

export interface ServerState {
    features: string[];
    configs: string[];
    runningNodeEnvironments: string[];
}

export interface ServerStateResponse extends SuccessResponse {
    data: ServerState;
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

export const isListNodeEnvironmtnrsResponse = (message: unknown): message is ListNodeEnvironmentsResponse =>
    isSuccessResponse(message) && !!(message as ListNodeEnvironmentsResponse).data;

export const isServerStateResponse = (message: unknown): message is ServerStateResponse =>
    isSuccessResponse(message) &&
    !!(message as ServerStateResponse).data &&
    !!(message as ServerStateResponse).data.features;

export const isErrorResponse = (message: unknown): message is ErrorResponse =>
    isServerResponseMessage(message) && message.result === 'error';

export const isPossibleFeaturesAndConfigs = (value: unknown): value is PossibleFeaturesAndConfigs =>
    value && typeof value === 'object' && (value as Record<string, any>).features;

export interface PossibleFeaturesAndConfigs {
    features: string[];
    configs: string[];
}
