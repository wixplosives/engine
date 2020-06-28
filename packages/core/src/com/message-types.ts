import type { SerializableArguments } from './types';

export interface RemoteCallAddress {
    api: string;
    method: string;
}

export interface BaseMessage {
    type: string;
    to: string;
    from: string;
    callbackId?: string;
    error?: string;
    origin: string;
}

export interface CallMessage extends BaseMessage {
    type: 'call';
    data: RemoteCallAddress & { args: SerializableArguments };
}

export interface CallbackMessage extends BaseMessage {
    type: 'callback';
    data?: SerializableArguments | unknown;
}

export interface ListenMessage extends BaseMessage {
    type: 'listen';
    data: RemoteCallAddress & { handlerId: string };
}

export interface UnListenMessage extends BaseMessage {
    type: 'unlisten';
    data: RemoteCallAddress & { handlerId: string };
}

export interface EventMessage extends BaseMessage {
    type: 'event';
    data: SerializableArguments;
    handlerId: string;
}

export interface ReadyMessage extends BaseMessage {
    type: 'ready';
}

export type Message = CallMessage | CallbackMessage | ListenMessage | UnListenMessage | EventMessage | ReadyMessage;
