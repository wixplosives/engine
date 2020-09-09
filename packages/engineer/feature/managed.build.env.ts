import managedFeature from './managed.feature';
import { buildEnv } from './build.feature';
import type { IProcessMessage, IFeatureMessagePayload, IFeatureTarget, IPortMessage } from '@wixc3/engine-scripts/src';
import type { IRunFeatureOptions } from '@wixc3/engine-scripts/src/application';
import { generateConfigName } from '@wixc3/engine-scripts/src/engine-router';
import performance from '@wixc3/cross-performance';

managedFeature.setup(
    buildEnv,
    (
        _,
        {
            buildFeature: {
                serverListeningHandlerSlot,
                getNodeEnvManager,
                overrideConfigsMap,
                devServerConfig: { nodeEnvironmentsMode, httpServerPort },
                close: closeServer,
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
            return getNodeEnvManager()!.runServerEnvironments({
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
            return getNodeEnvManager()!.closeEnvironment({
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
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
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

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        process.on('message', processListener);

        serverListeningHandlerSlot.register(() => {
            if (process.send) {
                process.send({ id: 'port-request', payload: { port: httpServerPort } } as IProcessMessage<
                    IPortMessage
                >);
            }
        });
    }
);
