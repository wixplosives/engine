import { createAllValidConfigurationsEnvironmentMapping, type IFeatureTarget } from '@wixc3/engine-scripts';
import {
    loadEngineConfig,
    readMetadataFiles,
    resolveRuntimeOptions,
    runEngine,
    RunEngineOptions,
    runLocalNodeManager,
} from '@wixc3/engine-cli';
import type { IExecutableApplication } from './types.js';
import { join } from 'path';
import { createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';

const OUTPUT_PATH = join(process.cwd(), 'dist-test-engine');

export class ManagedRunEngine implements IExecutableApplication {
    private ready!: Promise<void>;
    private runMetadata!: {
        featureEnvironmentsMapping: ReturnType<typeof createFeatureEnvironmentsMapping>;
        configMapping: ReturnType<typeof createAllValidConfigurationsEnvironmentMapping>;
    };
    constructor(private options: { skipBuild: boolean }) {}
    init() {
        if (this.ready === undefined) {
            this.ready = this.build();
        }
        return this.ready;
    }
    private async build() {
        if (this.options.skipBuild) {
            this.runMetadata = readMetadataFiles(OUTPUT_PATH);
            return;
        }
        const engineConfig = await loadEngineConfig(process.cwd());
        const build = this.options.skipBuild === false;
        const buildOnlyInDevModeOptions: RunEngineOptions = {
            clean: build,
            dev: true,
            watch: false,
            run: false,
            outputPath: OUTPUT_PATH,
            engineConfig,
            build,
            writeMetadataFiles: true,
        };
        const res = await runEngine(buildOnlyInDevModeOptions);

        const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(res.features);
        const configMapping = createAllValidConfigurationsEnvironmentMapping(res.configurations, 'development');
        this.runMetadata = {
            featureEnvironmentsMapping,
            configMapping,
        };
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
            this.runMetadata.featureEnvironmentsMapping,
            this.runMetadata.configMapping,
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
