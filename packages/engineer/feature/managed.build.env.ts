import managedFeature from './managed.feature';
import { buildEnv, BuildHooks } from './build.feature';
import type { IProcessMessage } from '@wixc3/engine-scripts/src';
import type { IRunFeatureOptions } from '@wixc3/engine-scripts/src/application';

managedFeature.setup(
    buildEnv,
    (
        _,
        {
            buildFeature: {
                buildHooksSlot,
                nodeEnvironmentManager,
                devServerConfig: { nodeEnvironmentsMode },
            },
        }
    ) => {
        const runFeature = async ({
            featureName,
            runtimeOptions = {},
            configName,
            overrideConfig,
        }: IRunFeatureOptions) => {
            if (overrideConfig) {
                const generatedConfigName = generateConfigName(configName);
                overrideConfigsMap.set(generatedConfigName, {
                    overrideConfig: Array.isArray(overrideConfig) ? overrideConfig : [],
                    configName,
                });
                configName = generatedConfigName;
            }
            // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
            performance.clearMeasures();
            performance.clearMarks();
            return nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                overrideConfigsMap,
                runtimeOptions,
                mode: nodeEnvironmentsMode,
            });
        };

        const closeFeature = ({ featureName, configName }: IFeatureMessagePayload) => {
            if (configName) {
                overrideConfigsMap.delete(configName);
            }
            performance.clearMeasures();
            performance.clearMarks();
            return nodeEnvironmentManager.closeEnvironment({
                featureName,
                configName,
            });
        };
        const getMetrics = () => {
            return {
                marks: performance.getEntriesByType('mark'),
                measures: performance.getEntriesByType('measure'),
            };
        };

        const serverReady = () => {
            const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
                if (process.send) {
                    if (id === 'run-feature') {
                        const responsePayload = await runFeature(payload as Required<IFeatureTarget>);
                        process.send({ id: 'feature-initialized', payload: responsePayload });
                    }
                    if (id === 'close-feature') {
                        await closeFeature(payload as IFeatureMessagePayload);
                        process.send({ id: 'feature-closed' });
                    }
                    if (id === 'server-disconnect') {
                        await closeServer();
                        process.off('message', processListener);
                        process.send({ id: 'server-disconnected' });
                    }
                    if (id === 'metrics-request') {
                        process.send({
                            id: 'metrics-response',
                            payload: getMetrics(),
                        });
                    }
                }
            };

            process.on('message', processListener);
        };
        buildHooksSlot.register(serverReady);
    }
);
