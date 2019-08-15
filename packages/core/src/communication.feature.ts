import { BaseHost } from './com/base-host';
import { Communication, ICommunicationOptions } from './com/communication';
import { LoggerService } from './com/logger-service';
import { Target, WindowHost } from './com/types';
import { Config } from './entities/config';
import {
    AllEnvironments,
    Environment,
    NodeEnvironment,
    SingleEndpointContextualEnvironment,
    Universal
} from './entities/env';
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
                resolvedContexts: {}
            },
            (a: IComConfig, b: Partial<IComConfig>) => ({
                ...a,
                ...b,
                topology: {
                    ...a.topology,
                    ...b.topology
                },
                resolvedContexts: {
                    ...a.resolvedContexts,
                    ...b.resolvedContexts
                }
            })
        ),
        loggerTransports: Slot.withType<LoggerTransport>().defineEntity(Universal),
        loggerService: Service.withType<LoggerService>().defineEntity(Universal),
        spawn: Service.withType<(endPoint: Environment, host?: WindowHost) => Promise<{ id: string }>>().defineEntity(
            AllEnvironments
        ),
        connect: Service.withType<(endPoint: NodeEnvironment<string>) => Promise<{ id: string }>>().defineEntity(
            AllEnvironments
        ),
        spawnOrConnect: Service.withType<
            (endPoint: SingleEndpointContextualEnvironment<string, Environment[]>) => Promise<{ id: string }>
        >().defineEntity(AllEnvironments),
        communication: Service.withType<Communication>().defineEntity(AllEnvironments)
    }
}).setup(
    Universal,
    ({
        config: { host, id, topology, maxLogMessages, loggerSeverity, logToConsole, resolvedContexts },
        loggerTransports,
        [RUN_OPTIONS]: runOptions
    }) => {
        // worker and iframe always get `name` when initialized as Environment.
        // it can be overridden using top level config.
        // main frame might not have that configured, so we use 'main' fallback for it.
        let communication: Communication;
        const warnOnSlow = runOptions.has('warnOnSlow');
        // TODO: find better way to detect node runtime
        const communicationOptions: ICommunicationOptions = {
            warnOnSlow
        };
        if (typeof process !== 'undefined' && process.title !== 'browser') {
            if (host) {
                communication = new Communication(
                    host,
                    id || host.name || 'main',
                    topology,
                    resolvedContexts,
                    communicationOptions
                );
            } else {
                communication = new Communication(
                    new BaseHost(),
                    id || 'main',
                    topology,
                    resolvedContexts,
                    communicationOptions
                );
            }
        } else {
            communication = new Communication(
                self,
                id || self.name || 'main',
                topology,
                resolvedContexts,
                communicationOptions
            );
        }

        const loggerService = new LoggerService(
            loggerTransports,
            { environment: communication.getEnvironmentId() },
            { severity: loggerSeverity!, maxLogMessages, logToConsole }
        );

        return {
            loggerService,
            communication,
            spawn: communication.spawn.bind(communication),
            connect: communication.connect.bind(communication),
            spawnOrConnect: communication.spawnOrConnect.bind(communication)
        };
    }
);
