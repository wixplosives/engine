import type { IFeatureMessagePayload, IProcessMessage, ErrorResponse } from './types';

export interface ServerResponse<T> extends IProcessMessage<T> {
    id: 'error' | 'feature-initialized' | 'feature-closed';
}

export interface SuccessResponse extends ServerResponse<IFeatureMessagePayload> {
    id: 'feature-initialized' | 'feature-closed';
}

export interface ListNodeEnvironmentsResponse extends SuccessResponse {
    data?: string[];
}

export type ServerFeatureDef = {
    configurations: string[];
    hasServerEnvironments: boolean;
    featureName: string;
};

export type RunningEngineFeature = [string, string];

export interface ServerState {
    features: Record<string, ServerFeatureDef>;
    featuresWithRunningNodeEnvs: RunningEngineFeature[];
}

export interface ServerStateResponse extends SuccessResponse {
    data: ServerState;
}

export const isServerResponseMessage = (message: unknown): message is ServerResponse<any> => {
    if (message && typeof message === 'object') {
        const result = (message as Record<string, unknown>).id;
        if (typeof result === 'string') {
            return ['feature-initialized', 'error', 'feature-closed'].includes(result);
        }
    }
    return false;
};

export const isSuccessResponse = (message: unknown): message is SuccessResponse =>
    isServerResponseMessage(message) && message.id === 'feature-initialized';

export const isListNodeEnvironmtnrsResponse = (message: unknown): message is ListNodeEnvironmentsResponse =>
    isSuccessResponse(message) && !!(message as ListNodeEnvironmentsResponse).data;

export const isServerStateResponse = (message: unknown): message is ServerStateResponse =>
    isSuccessResponse(message) &&
    !!(message as ServerStateResponse).data &&
    !!(message as ServerStateResponse).data.features;

export const isErrorResponse = (message: unknown): message is ErrorResponse =>
    isServerResponseMessage(message) && message.id === 'error';

export const isPossibleFeaturesAndConfigs = (value: unknown): value is PossibleFeaturesAndConfigs =>
    value && typeof value === 'object' && (value as Record<string, any>).features;

export interface PossibleFeaturesAndConfigs {
    features: string[];
    configs: string[];
}
