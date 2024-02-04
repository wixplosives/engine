import { createAllValidConfigurationsEnvironmentMapping, type IFeatureTarget } from '@wixc3/engine-scripts';
import {
    loadEngineConfig,
    readMetadataFiles,
    resolveRuntimeOptions,
    runEngine,
    RunEngineOptions,
    runLocalNodeManager,
} from './engine-build';
import type { IExecutableApplication } from './types.js';
import { join } from 'path';
import { createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import { checkWatchSignal } from './watch-signal';

const OUTPUT_PATH = process.env.ENGINE_OUTPUT_PATH || join(process.cwd(), 'dist-engine');

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
            try {
                this.runMetadata = readMetadataFiles(OUTPUT_PATH);
                const hasWatcherActive = await checkWatchSignal(OUTPUT_PATH);
                if (hasWatcherActive) {
                    console.log('[Engine]: Running with prebuilt application and active watcher.');
                    return;
                } else {
                    console.warn('[Engine]: No active watcher detected, running with stale cache');
                    return;
                }
            } catch (e) {
                console.warn(
                    `[Engine]: Could not read prebuilt metadata files at ${OUTPUT_PATH}`,
                    '[Engine]: Building fresh engine application',
                    '[Engine]: (in order fully take advantage of the prebuilt, run `engine --watch` before running this flow.)',
                );
            }
        }
        const engineConfig = await loadEngineConfig(process.cwd());

        const buildOnlyInDevModeOptions: RunEngineOptions = {
            build: true,
            clean: true,
            dev: true,
            watch: false,
            run: false,
            outputPath: OUTPUT_PATH,
            engineConfig,
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
