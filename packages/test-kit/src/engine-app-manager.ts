import { getMetricsFromProcess, type PerformanceMetrics } from '@wixc3/engine-runtime-node';
import type { EngineConfig, IFeatureTarget } from '@wixc3/engine-scripts';
import { loadEngineConfig, runEngine, runNodeManager } from '@wixc3/engine-cli';
import type { IExecutableApplication } from './types.js';
import { join } from 'path';

const OUTPUT_PATH = join(process.cwd(), 'dist-test-engine');

export class ManagedRunEngine implements IExecutableApplication {
    private ready: Promise<{ engineConfig: EngineConfig }>;
    constructor(/* { cwd = process.cwd(), featureDiscoveryRoot = 'src' } */) {
        this.ready = this.run();
    }
    private async run() {
        const engineConfig = await loadEngineConfig(process.cwd());

        const buildOnlyInDevModeOptions = {
            clean: true,
            dev: true,
            watch: false,
            run: false,
            outputPath: OUTPUT_PATH,
            engineConfig,
        };
        await runEngine(buildOnlyInDevModeOptions);

        return { engineConfig };
    }
    public getServerPort(): Promise<number> {
        throw new Error('not implemented');
    }

    public async runFeature(featureTarget: IFeatureTarget) {
        await this.ready;

        const { featureName, configName = '', overrideConfig, runtimeOptions } = featureTarget;
        if (!featureName) {
            throw new Error('featureName and configName are required');
        }

        const { managerProcess } = runNodeManager({
            configName,
            featureName,
            outputPath: OUTPUT_PATH,
            verbose: false,
            runtimeArgs: {
                ...runtimeOptions,
                topLevelConfig: JSON.stringify(overrideConfig),
            },
        });

        const port = await new Promise((resolve, reject) => {
            const errMessage = (msg = '') =>
                `starting node environment for feature: "${featureName}" and config: "${configName}" failed. ${msg}`;
            managerProcess.once('error', (e) => {
                reject(new Error(errMessage(), { cause: e }));
            });
            managerProcess.once('message', (message) => {
                if (typeof message === 'object' && 'port' in message) {
                    resolve(message.port);
                } else {
                    reject(
                        new Error(
                            errMessage('Invalid init message. expected {port:string} got ' + JSON.stringify(message)),
                        ),
                    );
                }
            });
            const time = 10000;
            setTimeout(() => {
                reject(new Error(errMessage(`Timeout after ${time / 1000} sec, waiting for init message.`)));
            }, time);
        });
        // this is for config proxy...we might want to change approach here related to overrideConfig
        // for now we don't support it
        return {
            featureName,
            configName,
            url: `http://localhost:${port}/main.html`,
            dispose() {
                managerProcess.kill();
            },
            getMetrics: () => getMetricsFromProcess(managerProcess),
        };
    }

    public async closeServer() {}

    public getMetrics(): Promise<PerformanceMetrics> {
        throw new Error('not implemented');
    }
}
