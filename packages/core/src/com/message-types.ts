import { SerializableArguments } from './types';

export interface RemoteCallAddress {
    api: string;
    method: string;
    rootEnvId: string;
    envId: string;
}

export interface BaseMessage {
    type: string;
    to: string;
    from: string;
    callbackId?: string;
    handlerId?: RemoteCallAddress;
    error?: string;
}

export interface CallMessage extends BaseMessage {
    type: 'call';
    data: SerializableArguments;
}

export interface CallbackMessage extends BaseMessage {
    type: 'callback';
    data?: unknown;
}

export interface ListenMessage extends BaseMessage {
    type: 'listen';
}

export interface EventMessage extends BaseMessage {
    type: 'event';
    data: SerializableArguments;
}

export interface ReadyMessage extends BaseMessage {
    type: 'ready';
}

export type Message = CallMessage | CallbackMessage | ListenMessage | EventMessage | ReadyMessage;
