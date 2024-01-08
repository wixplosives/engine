import { timeout } from 'promise-assist';
import {
    globallyProvidingEnvironments,
    normEnvVisibility,
    orderedEnvDependencies,
    type AnyEnvironment,
    type FeatureClass,
} from './entities/index.js';
import { createFeatureRuntime, type RuntimeFeature } from './runtime-feature.js';
import { RUN } from './symbols.js';
import type { IRunOptions, TopLevelConfig } from './types.js';

export class RuntimeEngine<ENV extends AnyEnvironment = AnyEnvironment> {
    public features = new Map<FeatureClass, RuntimeFeature<any, ENV>>();
    public referencedEnvs: Set<string>;
    private running: Promise<void[]> | undefined;
    private shutingDown = false;
    private topLevelConfigMap: Record<string, object[]>;
    public runningEnvNames: Set<string>;
    constructor(
        public entryEnvironment: ENV,
        topLevelConfig: TopLevelConfig = [],
        public runOptions: IRunOptions = new Map(),
        readonly featureShutdownTimeout = 10_000,
    ) {
        this.topLevelConfigMap = this.createConfigMap(topLevelConfig);
        this.referencedEnvs = new Set([...globallyProvidingEnvironments, ...orderedEnvDependencies(entryEnvironment)]);
        this.runningEnvNames = normEnvVisibility(entryEnvironment);
    }

    public get<T extends FeatureClass>(feature: T): RuntimeFeature<T, ENV> {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            return runningFeature as RuntimeFeature<T, ENV>;
        } else {
            throw new Error(`Feature not found: ${feature.id}`);
        }
    }

    public async run(features: FeatureClass | FeatureClass[]) {
        if (this.running) {
            throw new Error('Engine already running!');
        }
        if (!Array.isArray(features)) {
            features = [features];
        }
        try {
            for (const feature of features) {
                this.initFeature(feature);
            }
            const runPromises: Array<Promise<void>> = [];
            for (const feature of features) {
                runPromises.push(this.runFeature(feature));
            }
            // set before await since its a flag for dispose
            this.running = Promise.all(runPromises);
            await this.running;
        } catch (e) {
            await this.shutdown();
            throw e;
        }
        return this;
    }

    public initFeature<T extends FeatureClass>(feature: T): RuntimeFeature<T, ENV> {
        let instance = this.features.get(feature);
        if (!instance) {
            instance = createFeatureRuntime(feature, this);
        }
        return instance;
    }

    public async runFeature(feature: FeatureClass): Promise<void> {
        const featureInstance = this.features.get(feature);
        if (!featureInstance) {
            throw new Error(`Feature not found during run phase: ${feature.id}`);
        }
        const startTime = Date.now();
        const intervalId = setInterval(() => {
            console.log(
                `[${this.entryEnvironment.env}]: Feature ${feature.id} "run()" is taking ${(
                    (Date.now() - startTime) /
                    1000
                ).toFixed(2)}s`,
            );
        }, 15000);
        await featureInstance[RUN](this);
        clearInterval(intervalId);
    }

    public shutdown = async () => {
        if (!this.running) {
            return;
        }
        if (this.shutingDown) {
            return;
        }
        this.shutingDown = true;
        try {
            // don't report error on running
            await Promise.allSettled([this.running]);
            this.running = undefined;
            const toDispose = Array.from(this.features.values()).reverse();
            for (const feature of toDispose) {
                await timeout(
                    feature.dispose(),
                    this.featureShutdownTimeout,
                    `Failed to dispose feature: ${feature.feature.id}`,
                );
            }
        } finally {
            this.shutingDown = false;
        }
    };

    public getTopLevelConfig(featureId: string, configId: string) {
        return this.topLevelConfigMap[this.entityID(featureId, configId)] || [];
    }

    public entityID(featureId: string, entityKey: string) {
        return `${featureId}.${entityKey}`;
    }

    private createConfigMap(topLevelConfig: TopLevelConfig) {
        const configMap: Record<string, object[]> = {};
        for (const [featureId, multiValue] of topLevelConfig) {
            for (const [configId, value] of Object.entries(multiValue)) {
                const key = this.entityID(featureId, configId);
                configMap[key] = configMap[key] || [];
                configMap[key]!.push(value);
            }
        }
        return configMap;
    }
}
