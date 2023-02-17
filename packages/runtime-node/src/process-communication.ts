import type io from 'socket.io';
import { COM, ConfigEnvironmentRecord, PartialFeatureConfig } from '@wixc3/engine-core';
import { IPCHost, LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID } from '@wixc3/engine-core-node';
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
    const environments: Record<string, () => unknown> = {};

    const messageHandler = async (message: ICommunicationMessage) => {
        if (isEnvironmentPortMessage(message)) {
            remoteProcess.postMessage({ id: 'port-request', payload: { port } } as IEnvironmentPortMessage);
        } else if (isEnvironmentStartMessage(message)) {
            // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
            performance.clearMarks();
            performance.clearMeasures();
            const ipcHost = new IPCHost(process);
            // re-mapping all provided connected environments to use the IPC host, to allow, through the parent process, access other node environments
            const connectedEnvironments: Record<string, ConfigEnvironmentRecord> = {};
            //TODO: check
            for (const [envName, config] of message.data.config ?? []) {
                if (envName === COM.id) {
                    const typedConfig = (config as PartialFeatureConfig<(typeof COM)['api']>).config ?? {};
                    const { connectedEnvironments: definedConnectedEnvironments } = typedConfig;
                    if (definedConnectedEnvironments) {
                        for (const [envToken, envRecord] of Object.entries(definedConnectedEnvironments)) {
                            if (!connectedEnvironments[envToken]) {
                                connectedEnvironments[envToken] = {
                                    ...envRecord,
                                    host: ipcHost,
                                };
                            }
                        }
                        delete typedConfig?.connectedEnvironments;
                    }
                }
            }
            connectedEnvironments[LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID] = {
                host: ipcHost,
                id: LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID,
                registerMessageHandler: true,
            };
            const { close } = await runWSEnvironment(socketServer, {
                ...message.data,
                config: [
                    ...(message.data.config ?? []),
                    COM.use({
                        config: {
                            connectedEnvironments,
                        },
                    }),
                ],
            }).start();

            environments[message.envName] = close;
            remoteProcess.postMessage({ id: 'start' });
        } else if (isEnvironmentCloseMessage(message) && environments[message.envName]) {
            await environments[message.envName]!();
            remoteProcess.off('message', messageHandler);
            performance.clearMarks();
            performance.clearMeasures();
            if (onClose) {
                await onClose();
            }

            remoteProcess.postMessage({ id: 'close' });

            // clears all listeners. does not force close
            remoteProcess.terminate?.();
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
