import { COM, ConfigModule, type TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition, NodeEnvironmentsManager, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import type { SetMultiMap } from '@wixc3/patterns';
import type express from 'express';
import { importFresh } from './import-fresh.js';

export interface OverrideConfig {
    configName?: string;
    overrideConfig: TopLevelConfig;
}

export function createLiveConfigsMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | TopLevelConfig>,
    basePath: string,
    overrideConfigMap: Map<string, OverrideConfig>,
): express.RequestHandler {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return async (req, res, next) => {
        const config: TopLevelConfig = [];
        const { env: reqEnv } = req.query;
        const overrideConfig: TopLevelConfig = [];

        let requestedConfig: string | undefined = req.path.slice(1);
        requestedConfig = requestedConfig === 'undefined' ? undefined : requestedConfig;

        if (requestedConfig) {
            const currentOverrideConfig = overrideConfigMap.get(requestedConfig);
            if (currentOverrideConfig) {
                const { overrideConfig: providedOverrideConfig, configName } = currentOverrideConfig;
                requestedConfig = configName;
                overrideConfig.push(...providedOverrideConfig);
            }
            if (requestedConfig) {
                const configDefinitions = configurations.get(requestedConfig);

                if (configDefinitions) {
                    for (const configDefinition of configDefinitions) {
                        if (Array.isArray(configDefinition)) {
                            // dont evaluate configs on bundled version
                            config.push(...configDefinition);
                        } else {
                            const { filePath, envName } = configDefinition;
                            if (envName === reqEnv || !envName) {
                                const resolvedPath = require.resolve(filePath, { paths: [basePath] });
                                try {
                                    const { default: configValue } = (await importFresh(resolvedPath)) as ConfigModule;
                                    config.push(...configValue);
                                } catch (e) {
                                    console.error(
                                        new Error(`Failed evaluating config file: ${filePath}`, { cause: e }),
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
        (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig = (
            res.locals as {
                topLevelConfig: TopLevelConfig[];
            }
        ).topLevelConfig.concat(config, overrideConfig);
        next();
    };
}

export function createCommunicationMiddleware(
    nodeEnvironmentsManager: NodeEnvironmentsManager,
    publicPath?: string,
    topologyOverrides?: (featureName: string) => Record<string, string> | undefined,
): express.RequestHandler {
    return (req, res, next) => {
        const { feature } = req.query;
        const requestedConfig: string | undefined = req.path.slice(1);
        const topology =
            typeof feature === 'string'
                ? topologyOverrides && topologyOverrides(feature)
                    ? topologyOverrides(feature)
                    : nodeEnvironmentsManager.getTopology(
                          feature,
                          requestedConfig === 'undefined' ? undefined : requestedConfig,
                      )
                : undefined;
        (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig = (
            res.locals as {
                topLevelConfig: TopLevelConfig[];
            }
        ).topLevelConfig.concat([
            COM.use({
                config: {
                    topology,
                    publicPath,
                },
            }),
        ]);
        next();
    };
}

export const createConfigMiddleware: (
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider,
) => express.RequestHandler =
    (overrideConfig = []) =>
    (req, res) => {
        const { env: reqEnv } = req.query;
        res.send(
            (res.locals as { topLevelConfig: TopLevelConfig[] }).topLevelConfig.concat(
                Array.isArray(overrideConfig) ? overrideConfig : reqEnv ? overrideConfig(reqEnv as string) : [],
            ),
        );
    };

export const ensureTopLevelConfigMiddleware: express.RequestHandler = (_, res, next) => {
    if (!res.locals.topLevelConfig) {
        res.locals.topLevelConfig = [];
    }
    next();
};
