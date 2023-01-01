import { globallyProvidingEnvironments, orderedEnvDependencies, AnyEnvironment } from './entities';
import { createFeatureRuntime, RuntimeFeature } from './runtime-feature';
import type { FeatureDescriptor } from './entities/feature-descriptor';
import { RUN } from './symbols';
import type { IRunOptions, TopLevelConfig } from './types';
import { deferred, IDeferredPromise } from 'promise-assist';

export class RuntimeEngine<ENV extends AnyEnvironment = AnyEnvironment> {
    public features = new Map<FeatureDescriptor['id'], RuntimeFeature<FeatureDescriptor, ENV>>();
    public referencedEnvs: Set<string>;
    private running: IDeferredPromise<void> | undefined;
    private topLevelConfigMap: Record<string, object[]>;
    constructor(
        public entryEnvironment: ENV,
        topLevelConfig: TopLevelConfig = [],
        public runOptions: IRunOptions = new Map()
    ) {
        this.topLevelConfigMap = this.createConfigMap(topLevelConfig);
        this.referencedEnvs = new Set([...globallyProvidingEnvironments, ...orderedEnvDependencies(entryEnvironment)]);
    }

    public get<T extends FeatureDescriptor>(feature: T): RuntimeFeature<T, ENV> {
        const runningFeature = this.features.get(feature.id);
        if (runningFeature) {
            return runningFeature as RuntimeFeature<T, ENV>;
        } else {
            throw new Error(`missing feature ${feature.id}`);
        }
    }

    public async run(features: FeatureDescriptor | FeatureDescriptor[]) {
        if (this.running) {
            throw new Error('Engine already running!');
        }
        if (!Array.isArray(features)) {
            features = [features];
        }
        this.running = deferred();
        try {
            for (const feature of features) {
                this.initFeature(feature);
            }
            const runPromises: Array<Promise<void>> = [];
            for (const feature of features) {
                runPromises.push(this.runFeature(feature));
            }
            await Promise.all(runPromises);
            this.running.resolve();
        } catch (e) {
            this.running.reject(e);
        }
        return this;
    }

    public initFeature<T extends FeatureDescriptor>(feature: T): RuntimeFeature<FeatureDescriptor, ENV> {
        let instance = this.features.get(feature.id);
        if (!instance) {
            instance = createFeatureRuntime(feature, this);
        }
        return instance;
    }

    public async runFeature(feature: FeatureDescriptor): Promise<void> {
        const featureInstance = this.features.get(feature.id);
        if (!featureInstance) {
            throw new Error('Could not find running feature: ' + feature.id);
        }
        await featureInstance[RUN](this);
    }

    public async shutdown() {
        if (!this.running) {
            return;
        }
        await this.running.promise;
        for (const feature of this.features.values()) {
            await feature.dispose();
        }
        this.running = undefined;
    }

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
