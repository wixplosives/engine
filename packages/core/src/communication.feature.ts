import { BaseHost } from './com/hosts/base-host';
import { Communication, ICommunicationOptions } from './com/communication';
import { LoggerService } from './com/logger-service';
import type { Target } from './com/types';
import { Config } from './entities/config';
import { AllEnvironments, Universal } from './entities/env';
import { Feature } from './entities/feature';
import { Service } from './entities/service';
import { Slot } from './entities/slot';
import { RUN_OPTIONS } from './symbols';
import { LoggerTransport, LogLevel } from './types';

export interface IComConfig {
    id?: string;
    host?: Target;
    topology: Record<string, string>;
    resolvedContexts: Record<string, string>;
    loggerSeverity: LogLevel;
    logToConsole?: boolean;
    maxLogMessages: number;
    publicPath?: string;
}

export default new Feature({
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
            })
        ),
        loggerTransports: Slot.withType<LoggerTransport>().defineEntity(Universal),
        loggerService: Service.withType<LoggerService>().defineEntity(Universal),
        startEnvironment: Service.withType<Communication['startEnvironment']>().defineEntity(AllEnvironments),
        communication: Service.withType<Communication>().defineEntity(AllEnvironments),
    },
}).setup(
    Universal,
    ({
        config: { host, id, topology, maxLogMessages, loggerSeverity, logToConsole, resolvedContexts, publicPath },
        loggerTransports,
        [RUN_OPTIONS]: runOptions,
        runningEnvironmentName,
        onDispose,
    }) => {
        // TODO: find better way to detect node runtime
        const isNode = typeof process !== 'undefined' && process.title !== 'browser' && process.type !== 'renderer';

        // worker and iframe always get `name` when initialized as Environment.
        // it can be overridden using top level config.
        // main frame might not have that configured, so we use 'main' fallback for it.
        const comId = id || (host && host.name) || (typeof self !== 'undefined' && self.name) || runningEnvironmentName;

        const comOptions: ICommunicationOptions = {
            warnOnSlow: runOptions.has('warnOnSlow'),
            publicPath,
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
            startEnvironment: communication.startEnvironment.bind(communication),
        };
    }
);
