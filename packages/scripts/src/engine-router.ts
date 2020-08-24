import { Router } from 'express';
import bodyParser from 'body-parser';
import performance from '@wixc3/cross-performance';

import type { OverrideConfig } from './config-middleware';
import type { NodeEnvironmentsManager } from './node-environments-manager';
import type { IProcessMessage, IFeatureMessagePayload, IFeatureTarget } from './types';

export function createFeaturesEngineRouter(
    overrideConfigsMap: Map<string, OverrideConfig>,
    nodeEnvironmentManager: NodeEnvironmentsManager
) {
    const router = Router();
    router.use(bodyParser.json());

    router.put('/', async (req, res) => {
        const { configName, featureName, runtimeOptions: options, overrideConfig }: Required<IFeatureTarget> = req.body;
        try {
            let providedConfigName = configName;
            if (overrideConfig && Array.isArray(overrideConfig)) {
                const generatedConfigName = generateConfigName(configName);
                overrideConfigsMap.set(generatedConfigName, { overrideConfig, configName });
                providedConfigName = generatedConfigName;
            }
            // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
            performance.clearMarks();
            performance.clearMeasures();
            await nodeEnvironmentManager.runServerEnvironments({
                configName: providedConfigName,
                featureName,
                runtimeOptions: options,
                overrideConfigsMap,
            });
            res.json({
                id: 'feature-initialized',
                payload: {
                    configName: providedConfigName,
                    featureName,
                },
            } as IProcessMessage<IFeatureMessagePayload>);
        } catch (error) {
            res.status(404).json({
                id: 'error',
                error: error && error.message,
            });
        }
    });

    router.post('/', async (req, res) => {
        const { featureName, configName }: Required<IFeatureTarget> = req.body;
        overrideConfigsMap.delete(configName);
        try {
            await nodeEnvironmentManager.closeEnvironment({ featureName, configName });
            performance.clearMarks();
            performance.clearMeasures();
            res.json({
                id: 'feature-closed',
                payload: {
                    featureName,
                    configName,
                },
            } as IProcessMessage<IFeatureMessagePayload>);
        } catch (error) {
            res.status(404).json({
                result: 'error',
                error: error && error.message,
            });
        }
    });

    router.get('/', (_req, res) => {
        try {
            const data = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
            res.json({
                result: 'success',
                data,
            });
        } catch (error) {
            res.status(404).json({
                result: 'error',
                error: error && error.message,
            });
        }
    });

    router.get('/metrics', (_req, res) => {
        try {
            res.json({
                result: 'success',
                payload: {
                    marks: performance.getEntriesByType('mark'),
                    measures: performance.getEntriesByType('measure'),
                },
            });
        } catch (error) {
            res.status(404).json({
                result: 'error',
                error: error && error.message,
            });
        }
    });

    return router;
}

export function generateConfigName(configName?: string) {
    return `${configName ?? ''}__${uniqueHash()}`;
}
export function uniqueHash() {
    return Math.random().toString(16).slice(2);
}
