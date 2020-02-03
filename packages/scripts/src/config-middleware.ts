import { COM, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';
import express from 'express';
import importFresh from 'import-fresh';
import { IConfigDefinition } from './types';
import { resolveFrom } from './utils';
import { delimiter } from 'path';
// import { NodeEnvironmentsManager } from './node-environments-manager';

export interface OverrideConfig {
    configName?: string;
    config: TopLevelConfig;
}

export function createLiveConfigsMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | TopLevelConfig>,
    basePath: string,
    overrideConfigMap: Map<string, OverrideConfig>
): express.RequestHandler {
    return (req, res, next) => {
        const config: TopLevelConfig = [];
        const { env: reqEnv } = req.query;
        const overrideConfig: TopLevelConfig = [];

        let requestedConfig: string | undefined = req.path.slice(1);
        requestedConfig = requestedConfig === 'undefined' ? undefined : requestedConfig;

        if (requestedConfig) {
            const currentOverrideConfig = overrideConfigMap.get(requestedConfig);
            if (currentOverrideConfig) {
                const { config: providedOverrideConfig, configName } = currentOverrideConfig;
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
                                const resolvedPath = resolveFrom(basePath, filePath);
                                if (resolvedPath) {
                                    try {
                                        const { default: configValue } = importFresh(resolvedPath) as {
                                            default: TopLevelConfig;
                                        };
                                        config.push(...configValue);
                                    } catch (e) {
                                        console.error(`Failed evaluating config file: ${filePath}`);
                                        console.error(e);
                                    }
                                } else {
                                    throw new Error(`cannot find ${filePath}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        res.locals.topLevelConfig = res.locals.topLevelConfig.concat(config, overrideConfig);
        next();
    };
}

export function createTopologyMiddleware(
    topology: Map<string, Record<string, string>>,
    publicPath?: string
): express.RequestHandler {
    return (req, res, next) => {
        const { feature } = req.query;
        const requestedConfig: string | undefined = req.path.slice(1);
        res.locals.topLevelConfig = res.locals.topLevelConfig.concat([
            COM.use({
                config: {
                    topology: topology.get(`${feature}${delimiter}${requestedConfig}`),
                    publicPath
                }
            })
        ]);
        next();
    };
}

export const createConfigMiddleware: (runtimeConfig?: TopLevelConfig) => express.RequestHandler = (
    runtimeConfig = []
) => (_req, res) => {
    res.send(res.locals.topLevelConfig.concat(runtimeConfig));
};

export const ensureTopLevelConfigMiddleware: express.RequestHandler = (_, res, next) => {
    if (!res.locals.topLevelConfig) {
        res.locals.topLevelConfig = [];
    }
    next();
};
