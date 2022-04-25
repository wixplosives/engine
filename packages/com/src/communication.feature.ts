import process from 'process';
import { BaseHost } from './com/hosts/base-host';
import { Communication, ConfigEnvironmentRecord, ICommunicationOptions } from './com/communication';
import { LoggerService } from './com/logger-service';
import { AllEnvironments, Universal, Config, RUN_OPTIONS, ENGINE, Feature, Slot, Value } from '@wixc3/engine-core';
import { LogLevel, type LoggerTransport, type Target } from './types';

export interface IComConfig {
    id?: string;
    host?: Target;
    topology: Record<string, string>;
    resolvedContexts: Record<string, string>;
    loggerSeverity: LogLevel;
    logToConsole?: boolean;
    maxLogMessages: number;
    publicPath?: string;
    connectedEnvironments?: { [environmentId: string]: ConfigEnvironmentRecord };
}

export const COM = new Feature({
    id: 'COM',
    api: {
        config: Config.withType<IComConfig>().defineEntity(
            {
                id: '',
                loggerSeverity: LogLevel.DEBUG,
                maxLogMessages: 100,
                topology: {},
                resolvedContexts: {},
            },
            (a: IComConfig, b: Partial<IComConfig>) => ({
                ...a,
                ...b,
                topology: {
                    ...a.topology,
                    ...b.topology,
                },
                resolvedContexts: {
                    ...a.resolvedContexts,
                    ...b.resolvedContexts,
                },
                connectedEnvironments: {
                    ...a.connectedEnvironments,
                    ...b.connectedEnvironments,
                },
            })
        ),
        loggerTransports: Slot.withType<LoggerTransport>().defineEntity(Universal),
        loggerService: Value.withType<LoggerService>().defineEntity(Universal),
        communication: Value.withType<Communication>().defineEntity(AllEnvironments),
    },
}).setup(
    Universal,
    ({
        config: {
            host,
            id,
            topology,
            maxLogMessages,
            loggerSeverity,
            logToConsole,
            resolvedContexts,
            publicPath,
            connectedEnvironments = {},
        },
        loggerTransports,
        [RUN_OPTIONS]: runOptions,
        [ENGINE]: engine,
        onDispose,
    }) => {
        const isNode =
            !!process.versions?.node &&
            process.title !== 'browser' &&
            // in electron process also have type 'renderer'
            (process as { type?: string }).type !== 'renderer';

        // worker and iframe always get `name` when initialized as Environment.
        // it can be overridden using top level config.
        // main frame might not have that configured, so we use 'main' fallback for it.
        const comId =
            id || (host && host.name) || (typeof self !== 'undefined' && self.name) || engine.entryEnvironment.env;

        const comOptions: ICommunicationOptions = {
            warnOnSlow: runOptions.has('warnOnSlow'),
            publicPath,
            connectedEnvironments,
        };

        const communication = new Communication(
            isNode ? host || new BaseHost() : self,
            comId,
            topology,
            resolvedContexts,
            isNode,
            comOptions
        );

        const loggerService = new LoggerService(
            loggerTransports,
            { environment: communication.getEnvironmentId() },
            { severity: loggerSeverity, maxLogMessages, logToConsole }
        );

        onDispose(() => communication.dispose());
        return {
            loggerService,
            communication,
        };
    }
);

COM.entryConfig = ({ publicPath, resolvedContexts }) => {
    return COM.use({
        config: {
            publicPath,
            resolvedContexts,
        },
    });
};

export default COM;
