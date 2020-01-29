import { COM, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';
import express from 'express';
import importFresh from 'import-fresh';
import { IConfigDefinition } from './types';
import { resolveFrom } from './utils';

export type EngineConfigMiddleware = (req: express.Request) => TopLevelConfig;

export function createLiveConfigsMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | TopLevelConfig>,
    basePath: string
): EngineConfigMiddleware {
    return req => {
        const config: TopLevelConfig = [];
        const { env: reqEnv } = req.query;
        const requestedConfig = req.path.slice(1);
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

        return config;
    };
}

export function createTopologyMiddleware(
    topology: Map<string, Record<string, string>>,
    publicPath?: string
): EngineConfigMiddleware {
    return req => {
        const { feature: reqFeature } = req.query;
        return [COM.use({ config: { topology: topology.get(reqFeature), publicPath } })];
    };
}

export function createConfigMiddleware(
    configMiddlewares: EngineConfigMiddleware[]
): (config: TopLevelConfig) => express.RequestHandler {
    return config => (req, res) => {
        const topLevelConfigs = configMiddlewares.map(configMiddleware => configMiddleware(req));
        res.send([...topLevelConfigs, ...config]);
    };
}
