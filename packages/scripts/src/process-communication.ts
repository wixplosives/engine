import io from 'socket.io';

import { runNodeEnvironment } from './run-node-environment';
import {
    ICommunicationMessage,
    IEnvironmentPortMessage,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess
} from './types';

export interface ICreateCommunicationOptions {
    port: number;
    onClose?: () => unknown;
}

export function createCommunication(
    remoteProcess: RemoteProcess,
    socketServer: io.Server,
    { port, onClose }: ICreateCommunicationOptions
) {
    const environments: Record<string, { close: () => unknown }> = {};

    const messageHandler = async (message: ICommunicationMessage) => {
        if (isEnvironmentPortMessage(message)) {
            remoteProcess.postMessage({ id: 'port-request', port } as IEnvironmentPortMessage);
        } else if (isEnvironmentStartMessage(message)) {
            environments[message.envName] = await runNodeEnvironment(socketServer, message.data);
            remoteProcess.postMessage({ id: 'start' });
        } else if (isEnvironmentCloseMessage(message) && environments[message.envName]) {
            await environments[message.envName].close();
            remoteProcess.postMessage({ id: 'close' });
            remoteProcess.off('message', messageHandler);
            if (onClose) {
                await onClose();
            }
        }
    };

    remoteProcess.on('message', messageHandler);
}
