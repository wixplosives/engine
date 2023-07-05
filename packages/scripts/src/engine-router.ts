import { Router } from 'express';
import bodyParser from 'body-parser';

import type { OverrideConfig } from './config-middleware';
import type { IFeatureMessagePayload, IFeatureTarget } from './types';
import type { IProcessMessage, NodeEnvironmentsManager } from '@wixc3/engine-runtime-node';

export function createFeaturesEngineRouter(
    overrideConfigsMap: Map<string, OverrideConfig>,
    nodeEnvironmentManager: NodeEnvironmentsManager
) {
    const router = Router();
    router.use(bodyParser.json());

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    router.put('/', async (req, res) => {
        const {
            configName,
            featureName,
            runtimeOptions: options,
            overrideConfig,
        } = req.body as Required<IFeatureTarget>;
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
                error: error && (error as Error).message,
            });
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    router.post('/', async (req, res) => {
        const { featureName, configName } = req.body as Required<IFeatureTarget>;
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
                error: error && (error as Error).message,
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
                error: error && (error as Error).message,
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
                error: error && (error as Error).message,
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
