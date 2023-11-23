import { type EngineConfig, type IFeatureTarget } from '@wixc3/engine-scripts';
import { loadEngineConfig, resolveRuntimeOptions, runEngine, runLocalNodeManager } from '@wixc3/engine-cli';
import type { IExecutableApplication } from './types.js';
import { join } from 'path';

const OUTPUT_PATH = join(process.cwd(), 'dist-test-engine');

export class ManagedRunEngine implements IExecutableApplication {
    private ready!: Promise<{ engineConfig: EngineConfig }>;
    private runResult!: Awaited<ReturnType<typeof runEngine>>;
    constructor(private options: { skipBuild: boolean }) {}
    init() {
        if (this.ready === undefined) {
            this.ready = this.build();
        }
        return this.ready;
    }
    private async build() {
        if (this.options.skipBuild) {
            console.log('skipping build');
            return Promise.resolve({ engineConfig: {} });
        }
        const engineConfig = await loadEngineConfig(process.cwd());

        const buildOnlyInDevModeOptions = {
            clean: true,
            dev: true,
            watch: false,
            run: false,
            outputPath: OUTPUT_PATH,
            engineConfig,
        };
        this.runResult = await runEngine(buildOnlyInDevModeOptions);

        return { engineConfig };
    }
    public getServerPort(): Promise<number> {
        throw new Error('not implemented');
    }

    public async runFeature({ featureName, configName = '', overrideConfig, runtimeOptions }: IFeatureTarget) {
        await this.init();

        if (!featureName) {
            throw new Error('featureName and configName are required');
        }

        const execRuntimeOptions = resolveRuntimeOptions({
            configName,
            featureName,
            outputPath: OUTPUT_PATH,
            verbose: false,
            runtimeArgs: {
                ...runtimeOptions,
                topLevelConfig: JSON.stringify(overrideConfig),
            },
        });

        const { port, manager } = await runLocalNodeManager(
            this.runResult.features,
            this.runResult.configurations,
            configName,
            execRuntimeOptions,
            OUTPUT_PATH,
        );

        return {
            featureName,
            configName,
            url: `http://localhost:${port}/main.html`,
            dispose: () => manager.dispose(),
            getMetrics: () => manager.collectMetricsFromAllOpenEnvironments(),
        };
    }

    public async closeServer() {}
}
