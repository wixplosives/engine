import { Router } from 'express';
import bodyParser from 'body-parser';

import { OverrideConfig } from './config-middleware';
import { NodeEnvironmentsManager } from './node-environments-manager';
import { IProcessMessage, IFeatureMessagePayload, IFeatureTarget } from './types';

export function createFeaturesEngineRouter(
    overrideConfigsMap: Map<string, OverrideConfig>,
    nodeEnvironmentManager: NodeEnvironmentsManager
) {
    const router = Router();
    router.use(bodyParser.json());

    router.put('/', async (req, res) => {
        const { configName, featureName, runtimeOptions: options, overrideConfig }: Required<IFeatureTarget> = req.body;
        try {
            const generatedConfigName = generateConfigName(configName);
            overrideConfigsMap.set(generatedConfigName, { overrideConfig, configName });
            await nodeEnvironmentManager.runServerEnvironments({
                configName,
                featureName,
                runtimeOptions: options,
                overrideConfigsMap
            });
            res.json({
                id: 'feature-initialized',
                payload: {
                    configName: generatedConfigName,
                    featureName
                }
            } as IProcessMessage<IFeatureMessagePayload>);
        } catch (error) {
            res.status(404).json({
                id: 'error',
                error: error && error.message
            });
        }
    });

    router.delete('/', async (req, res) => {
        const { featureName, configName }: Required<IFeatureTarget> = req.body;
        overrideConfigsMap.delete(configName);
        try {
            await nodeEnvironmentManager.closeEnvironment({ featureName, configName });
            res.json({
                id: 'feature-closed',
                payload: {
                    featureName,
                    configName
                }
            } as IProcessMessage<IFeatureMessagePayload>);
        } catch (error) {
            res.status(404).json({
                result: 'error',
                error: error && error.message
            });
        }
    });

    router.get('/', (_req, res) => {
        try {
            const data = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
            res.json({
                result: 'success',
                data
            });
        } catch (error) {
            res.status(404).json({
                result: 'error',
                error: error && error.message
            });
        }
    });

    return router;
}

export function generateConfigName(configName?: string) {
    return `${configName ?? ''}__${uniqueHash()}`;
}
export function uniqueHash() {
    return Math.random()
        .toString(16)
        .slice(2);
}
