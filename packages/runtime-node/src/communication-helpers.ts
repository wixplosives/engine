import { ChildProcess, Serializable } from 'node:child_process';
import { type MessagePort, type Worker } from 'node:worker_threads';
import { deferred } from 'promise-assist';

/**
 * Emits an event using specified emitter as MessagePort
 */
export function emitEvent<T extends Serializable>(
    emitter: MessagePort | Worker | NodeJS.Process | ChildProcess,
    event: T
) {
    if ('postMessage' in emitter) {
        emitter.postMessage(event);
    } else {
        if (emitter.send === undefined) {
            throw new Error('this process does not support events emitting');
        }

        emitter.send(event);
    }
}

/**
 * Executes remote call by sending `command` and waiting for event with specified `callbackEventId` to be emitted.
 *
 * @param child event emitter to use
 * @param command command that triggers execution on remote
 * @param callbackEventId id of event that is emitted by remote to pass execution result
 * @returns the event that is emitted as a call execution result
 */
export function executeRemoteCall<TCommand extends Serializable, TResult extends { id: string }>(
    emitter: ChildProcess | Worker,
    command: TCommand,
    callbackEventId: TResult['id']
): Promise<TResult> {
    const response = deferred<TResult>();

    const handler = (data: Serializable) => {
        const event = data as TResult;
        if (event.id === callbackEventId) {
            emitter.off('message', handler);
            response.resolve(event);
        }
    };
    emitter.on('message', handler);

    if ('send' in emitter) {
        emitter.send(command);
    } else {
        emitter.postMessage(command);
    }
    return response.promise;
}

/**
 * Subscribes for an even using specified event emitter
 */
export function onEvent<T extends { id: string }>(emitter: Worker | ChildProcess, handler: (e: T) => void) {
    emitter.on('message', (e) => {
        const workerEvent = e as T;
        if (workerEvent.id !== undefined) {
            handler(workerEvent);
        }
    });
}
