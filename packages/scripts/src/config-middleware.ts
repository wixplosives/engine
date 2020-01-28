import { COM, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';
import express from 'express';
import importFresh from 'import-fresh';
import { IConfigDefinition, IExportedConfigDefinition } from './types';
import { resolveFrom } from './utils';

export function createLiveConfigsMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | IExportedConfigDefinition>,
    basePath: string
): (configs: TopLevelConfig) => express.RequestHandler {
    return configs => {
        return async (req, _res, _next) => {
            const config: TopLevelConfig = [];
            const { env: reqEnv } = req.query;
            const requestedConfig = req.path.slice(1);
            const configDefinitions = configurations.get(requestedConfig);

            if (configDefinitions) {
                for (const configDefinition of configDefinitions) {
                    const { config: exportedConfig, filePath, envName } = configDefinition as IExportedConfigDefinition;
                    // dont evaluate configs on bundled version
                    if (envName === reqEnv || !envName) {
                        if (exportedConfig) {
                            config.push(...exportedConfig);
                        } else {
                            const resolvedPath = resolveFrom(basePath, filePath);
                            if (resolvedPath) {
                                try {
                                    const { default: configValue } = (await importFresh(resolvedPath)) as {
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

            configs.push(...config);
        };
    };
}

export function createTopologyMiddleware(
    topology: Map<string, Record<string, string>>,
    publicPath?: string
): (configs: TopLevelConfig) => express.RequestHandler {
    return configs => {
        return (req, _res, _next) => {
            const { feature: reqFeature } = req.query;
            configs.push(...[COM.use({ config: { topology: topology.get(reqFeature), publicPath } })]);
        };
    };
}

export function createConfigMiddleware(
    middlewares: ((configs: TopLevelConfig) => express.RequestHandler)[]
): (config: TopLevelConfig) => express.RequestHandler {
    return (config: TopLevelConfig) => (req, res, next) => {
        const topLevelConfigs: TopLevelConfig = [];
        const promises = [];
        for (const middleware of middlewares) {
            promises.push(middleware(topLevelConfigs)(req, res, next));
        }
        Promise.all(promises)
            .then(() => {
                res.send([...topLevelConfigs, ...config]);
            })
            .catch(ex => {
                res.status(500).json({
                    error: ex
                });
            });
    };
}
