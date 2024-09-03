import { BaseHost } from './com/hosts/base-host.js';
import { Communication } from './com/communication.js';
import { LoggerService } from './com/logger-service.js';
import type { ConfigEnvironmentRecord, Target } from './com/types.js';
import { Config } from './entities/config.js';
import { AllEnvironments, Universal } from './entities/env.js';
import { Feature } from './entities/feature.js';
import { Value } from './entities/value.js';
import { Slot } from './entities/slot.js';
import { ENGINE, RUN_OPTIONS } from './symbols.js';
import { type LoggerTransport, LogLevel } from './types.js';
import { WindowInitializerService } from './com/window-initializer-service.js';

export interface IComConfig {
    id?: string;
    host?: Target;
    topology: Record<string, string>;
    resolvedContexts: Record<string, string>;
    loggerSeverity: LogLevel;
    logToConsole?: boolean;
    maxLogMessages: number;
    publicPath?: string;
    connectedEnvironments?: {
        [environmentId: string]: ConfigEnvironmentRecord;
    };
}

export default class COM extends Feature<'COM'> {
    id = 'COM' as const;
    api = {
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
            }),
        ),
        loggerTransports: Slot.withType<LoggerTransport>().defineEntity(Universal),
        loggerService: Value.withType<LoggerService>().defineEntity(Universal),
        communication: Value.withType<Communication>().defineEntity(AllEnvironments),
    };
}

COM.setup(
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
            typeof process !== 'undefined' &&
            !!process.versions?.node &&
            process.title !== 'browser' &&
            // in electron process also have type 'renderer'
            process.type !== 'renderer';

        host ??= isNode ? new BaseHost() : self;
        // iframe gets `instanceId` with top level config
        // webworker gets `instanceId` set into `name` property when initialized as Environment.
        // it can be overridden using top level config.
        // main frame might not have that configured, so we use 'main' fallback for it.
        id ||= host?.name || self?.name || engine.entryEnvironment.env;

        const communication = new Communication(host, id, topology, resolvedContexts, isNode, {
            warnOnSlow: runOptions.has('warnOnSlow'),
            publicPath,
            connectedEnvironments,
        });

        // manually register window initialization api service to be used during
        // start of managed iframe in packages/core/src/com/initializers/iframe.ts
        communication.registerAPI({ id: WindowInitializerService.apiId }, new WindowInitializerService());

        const loggerService = new LoggerService(
            loggerTransports,
            { environment: communication.getEnvironmentId() },
            { severity: loggerSeverity, maxLogMessages, logToConsole },
        );

        onDispose(() => communication.dispose());

        return {
            loggerService,
            communication,
        };
    },
);

// rather than including the entire node types we define it locally
declare const process: {
    type?: string;
    title?: string;
    versions?: {
        node?: string;
    };
};
