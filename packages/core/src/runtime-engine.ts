import { timeout } from 'promise-assist';
import {
    globallyProvidingEnvironments,
    orderedEnvDependencies,
    AnyEnvironment,
    FeatureClass,
    normEnvVisibility,
} from './entities';
import { createFeatureRuntime, RuntimeFeature } from './runtime-feature';
import { RUN } from './symbols';
import type { IRunOptions, TopLevelConfig } from './types';

export class RuntimeEngine<ENV extends AnyEnvironment = AnyEnvironment> {
    public features = new Map<FeatureClass, RuntimeFeature<any, ENV>>();
    public referencedEnvs: Set<string>;
    private running: Promise<void[]> | undefined;
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
        await featureInstance[RUN](this);
    }

    public shutdown = async () => {
        if (!this.running) {
            return;
        }
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
