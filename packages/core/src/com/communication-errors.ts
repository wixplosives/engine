import type { Message } from './message-types';
import { quote, redactArguments } from './helpers';

export class EngineCommunicationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class DuplicateRegistrationError extends EngineCommunicationError {
    constructor(id: string, type: 'RemoteService' | 'Environment') {
        super(`Could not register same id ${id} as ${type}`);
    }
}

export class DoubleRegisterError extends EngineCommunicationError {
    constructor(handlerId: string) {
        super('Cannot add same listener instance twice ' + handlerId);
    }
}

export class UnConfiguredMethodError extends EngineCommunicationError {
    constructor(api: string, method: string) {
        super(`Cannot add listener to un-configured method ${api} ${method}`);
    }
}

export class UnknownCallbackIdError extends EngineCommunicationError {
    constructor(message: Message, hostId: string) {
        super(`Unknown callback id "${message.callbackId!}" at "${hostId}". Message:\n${quote(message)}`);
    }
}

export class CallbackTimeoutError extends EngineCommunicationError {
    constructor(callbackId: string, hostId: string, message: Message) {
        super(`Callback "${callbackId}" timed out at "${hostId}". Message:\n${quote(message)}`);
    }
}

export class EnvironmentDisconnectedError extends EngineCommunicationError {
    constructor(environment: string, hostId: string, message: Message) {
        super(
          `Remote call failed in "${environment}" - environment disconnected at "${hostId}". Message:\n${quote(message)}`,
        );
        this.cause = redactArguments(message);
    }
}
export class CircularForwardingError extends EngineCommunicationError {
    constructor(message: Message, fromEnv: string, toEnv: string) {
        super(
            `Forwarding message ${quote(message)} from "${fromEnv}" to "${toEnv}"\n\t^ is stuck in circular messaging loop ${JSON.stringify(
                message.forwardingChain,
            )}.
             This probably happened because you are forwarding a message to an environment that is not connected to the root environment`,
        );
    }
}
