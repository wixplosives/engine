import type { Message } from './message-types';

export const DUPLICATE_REGISTER = (id: string, type: 'RemoteService' | 'Environment') =>
    `Could not register same id ${id} as ${type}`;
export const GLOBAL_REF = (id: string) => `Com with id "${id}" is already running.`;
export const REMOTE_CALL_FAILED = (message: Message) =>
    `Remote call failed with error: "${message.error!}" from "${message.from}"`;
export const UNKNOWN_CALLBACK_ID = (message: Message) =>
    `Unknown callback id "${message.callbackId!}" in message:\n${JSON.stringify(message)}`;
export const CALLBACK_TIMEOUT = (callbackId: string, hostId: string, message: Message) =>
    `Callback timeout "${callbackId}" at ${hostId} on message:\n${JSON.stringify(message)}`;
export const MISSING_ENV = (target: string, environments: string[]) =>
    `Destination environment ${target} is not registered. available environments: [${environments.join(', ')}]`;
export const MISSING_FORWARD_FOR_MESSAGE = (message: Message) => `Not implemented forward for ${message.type}`;

export const MISSING_COM_CONTEXT = (id: string, when: string) =>
    `Missing communication context for "${id}" when ${when}`;

export const SPAWNED_MORE_THEN_ONCE = (id: string) => `Environment with id ${id} can only spawned once`;

export const MISSING_CONTEXT_FOR_API_PROXY = (type: string, remoteServiceId: string) =>
    `Missing ${type} when trying to get remote service api proxy for ${remoteServiceId}`;

export function reportError(e: Error) {
    console.error(e);
}
