import type io from 'socket.io';
import performance from '@wixc3/cross-performance';
performance.clearMeasures;
import { runWSEnvironment } from './ws-environment';
import {
    ICommunicationMessage,
    IEnvironmentPortMessage,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess,
    isEnvironmentMetricsRequestMessage,
    IEnvironmentMetricsResponse,
} from './types';

export interface ICreateCommunicationOptions {
    port: number;
    onClose?: () => unknown;
}

export function createIPC(
    remoteProcess: RemoteProcess,
    socketServer: io.Server,
    { port, onClose }: ICreateCommunicationOptions
) {
    const environments: Record<string, { close: () => unknown }> = {};

    const messageHandler = async (message: ICommunicationMessage) => {
        if (isEnvironmentPortMessage(message)) {
            remoteProcess.postMessage({ id: 'port-request', payload: { port } } as IEnvironmentPortMessage);
        } else if (isEnvironmentStartMessage(message)) {
            // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
            performance.clearMarks();
            performance.clearMeasures();
            environments[message.envName] = await runWSEnvironment(socketServer, message.data);
            remoteProcess.postMessage({ id: 'start' });
        } else if (isEnvironmentCloseMessage(message) && environments[message.envName]) {
            await environments[message.envName].close();
            remoteProcess.postMessage({ id: 'close' });
            remoteProcess.off('message', messageHandler);
            performance.clearMarks();
            performance.clearMeasures();
            if (onClose) {
                await onClose();
            }
        } else if (isEnvironmentMetricsRequestMessage(message)) {
            const metricsMessage: IEnvironmentMetricsResponse = {
                id: 'metrics-response',
                payload: {
                    marks: performance.getEntriesByType('mark'),
                    measures: performance.getEntriesByType('measure'),
                },
            };
            remoteProcess.postMessage(metricsMessage);
        }
    };

    remoteProcess.on('message', messageHandler);
}
