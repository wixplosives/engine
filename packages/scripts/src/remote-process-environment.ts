import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';

import { ForkedProcess } from './forked-process';
import { runNodeEnvironment } from './run-node-environment';
import {
    ICommunicationMessage,
    IEnvironmentPortMessage,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess
} from './types';

function getParentProcess(): RemoteProcess | null {
    // this is commented for when we will be able to debug with them.
    // try {
    //     const WorkerThreads = await import('worker_threads');
    //     return WorkerThreads.parentPort;
    // } catch {
    if (process.send) {
        return new ForkedProcess(process);
    }
    return null;
    // }
}

const parentProcess = getParentProcess();
if (parentProcess) {
    // tslint:disable-next-line: no-floating-promises
    createCommunication(parentProcess);
}

export async function createCommunication(remoteProcess: RemoteProcess) {
    const app = express();
    const environments: Record<string, { close: () => unknown }> = {};
    const { httpServer, port } = await safeListeningHttpServer(3000, app);
    const socketServer = io(httpServer);

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
        }
    };

    remoteProcess.on('message', messageHandler);
}
