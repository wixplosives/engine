import { SetMultiMap } from '@file-services/utils';
import { COM, TopLevelConfig } from '@wixc3/engine-core';
import express from 'express';
import importFresh from 'import-fresh';
import { IConfigDefinition } from './analyze-feature';

interface ConfigModule {
    default: TopLevelConfig;
}

export function createConfigMiddleware(
    configurations: SetMultiMap<string, IConfigDefinition>,
    topology: Map<string, Record<string, string>>
): express.RequestHandler {
    return async (req, res) => {
        const { feature: reqFeature, env: reqEnv } = req.query;
        const config: TopLevelConfig = [COM.use({ config: { topology: topology.get(reqFeature) } })];
        const requestedConfig = req.path.slice(1);
        const configDefinitions = configurations.get(requestedConfig);

        if (configDefinitions) {
            for (const { filePath, envName } of configDefinitions) {
                if (envName === reqEnv || !envName) {
                    try {
                        const { default: configValue } = (await importFresh(filePath)) as ConfigModule;
                        config.push(...configValue);
                    } catch (e) {
                        // tslint:disable: no-console
                        console.error(`Failed evaluating config file: ${filePath}`);
                        console.error(e);
                        // tslint:enable: no-console
                    }
                }
            }
        }
        res.send(config);
    };
}
