import { globallyProvidingEnvironments, orderedEnvDependencies, AnyEnvironment } from './entities';
import { createFeatureRuntime, RuntimeFeature } from './runtime-feature';
import type { FeatureDescriptor } from './entities/feature-descriptor';
import { DISPOSE, RUN } from './symbols';
import type { IRunOptions, TopLevelConfig } from './types';

export class RuntimeEngine<ENV extends AnyEnvironment = AnyEnvironment> {
    public features = new Map<FeatureDescriptor, RuntimeFeature<FeatureDescriptor, ENV>>();
    public referencedEnvs: Set<string>;
    private running = false;
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
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            return runningFeature as RuntimeFeature<T, ENV>;
        } else {
            throw new Error(`missing feature ${feature.id}`);
        }
    }

    public async run(features: FeatureDescriptor | FeatureDescriptor[]): Promise<this> {
        if (this.running) {
            throw new Error('Engine already running!');
        }
        this.running = true;
        if (!Array.isArray(features)) {
            features = [features];
        }
        for (const feature of features) {
            this.initFeature(feature);
        }
        const runPromises: Array<Promise<void>> = [];
        for (const feature of features) {
            runPromises.push(this.runFeature(feature));
        }
        await Promise.all(runPromises);
        return this;
    }

    public initFeature<T extends FeatureDescriptor>(feature: T): RuntimeFeature<FeatureDescriptor, ENV> {
        let instance = this.features.get(feature);
        if (!instance) {
            instance = createFeatureRuntime(feature, this);
        }
        return instance;
    }

    public async runFeature(feature: FeatureDescriptor): Promise<void> {
        const featureInstance = this.features.get(feature);
        if (!featureInstance) {
            throw new Error('Could not find running feature: ' + feature.id);
        }
        await featureInstance[RUN](this);
    }

    /**
     * @deprecated use disposeFeature instead
     */
    public async dispose(feature: FeatureDescriptor) {
        return this.disposeFeature(feature);
    }
    public async disposeFeature(feature: FeatureDescriptor) {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            await runningFeature[DISPOSE](this);
            this.features.delete(feature);
        }
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
