import { SetMultiMap } from '@file-services/utils';
import { COM, TopLevelConfig } from '@wixc3/engine-core';
import express from 'express';
import importFresh from 'import-fresh';
import { IConfigDefinition, IExportedConfigDefinition } from './types';
import { resolveFrom } from './utils';

export function createConfigMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition | IExportedConfigDefinition>,
    topology: Map<string, Record<string, string>>,
    basePath: string,
    publicPath?: string
): (config: TopLevelConfig) => express.RequestHandler {
    return (overrideConfig?: TopLevelConfig) => {
        return async (req, res) => {
            const { feature: reqFeature, env: reqEnv } = req.query;
            const config: TopLevelConfig = [COM.use({ config: { topology: topology.get(reqFeature), publicPath } })];
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
            if (overrideConfig?.length) {
                config.push(...overrideConfig);
            }

            res.send(config);
        };
    };
}
