import type { Message } from './message-types.js';

export const GLOBAL_REF = (id: string) => `Com with id "${id}" is already running.`;
export const REMOTE_CALL_FAILED = (environment: string, stack?: string) =>
    `Remote call failed in "${environment}"${stack ? `\n${stack}` : ''}`;
export const MISSING_ENV = (target: string, environments: string[]) =>
    `Destination environment ${target} is not registered. available environments: [${environments.join(', ')}]`;
export const MISSING_FORWARD_FOR_MESSAGE = (message: Message) => `Not implemented forward for ${message.type}`;

export const MISSING_COM_CONTEXT = (id: string, when: string) =>
    `Missing communication context for "${id}" when ${when}`;

export const SPAWNED_MORE_THEN_ONCE = (id: string) => `Environment with id ${id} can only spawned once`;

export const MISSING_CONTEXT_FOR_API_PROXY = (type: string, remoteServiceId: string) =>
    `Missing ${type} when trying to get remote service api proxy for ${remoteServiceId}`;

export const AUTO_REGISTER_ENVIRONMENT = (message: Message, hostId: string) =>
    `[autoRegisterEnvironment]: skipping host self registration at "${hostId}" for message ${JSON.stringify(message)}`;

export const MESSAGE_FROM_UNKNOWN_ENVIRONMENT = (message: Message, hostId: string, origin = '') =>
    `Received message from unknown environment ${origin ? origin + ' ' : ''} "${
        message.from
    }" at "${hostId}": ${JSON.stringify(message)}`;

export const FORWARDING_MESSAGE = (message: Message, fromEnv: string, toEnv: string) =>
    `forwarding message ${JSON.stringify(message)} from ${fromEnv} to ${toEnv}`;

export const REGISTER_ENV = (id: string, hostId: string) => `registering env ${id} at ${hostId}`;

export const UNHANDLED = (message: Message, hostId: string) =>
    `[DEBUG] unhandledMessage received at ${hostId}. message:\n${JSON.stringify(message, null, 2)}`;

export const reportError =
    globalThis.reportError ??
    function reportError(e: unknown) {
        console.error(e);
    };
