import COM from './communication.feature';
import type { RuntimeFeature, Feature, Environment } from './entities';
import { CREATE_RUNTIME, DISPOSE, RUN } from './symbols';
import type { IRunOptions, TopLevelConfig } from './types';

export class RuntimeEngine<ENV extends Environment = Environment> {
    public features = new Map<Feature, RuntimeFeature<Feature, ENV>>();
    private running = false;
    private topLevelConfigMap: Record<string, object[]>;
    constructor(private env: ENV, topLevelConfig: TopLevelConfig = [], public runOptions: IRunOptions = new Map()) {
        this.topLevelConfigMap = this.createConfigMap(topLevelConfig);
    }

    public get<T extends Feature>(feature: T): RuntimeFeature<T, ENV> {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            return runningFeature as RuntimeFeature<T, ENV>;
        } else {
            throw new Error(`missing feature ${feature.id}`);
        }
    }

    public async run(features: Feature | Feature[]): Promise<this> {
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

    public initFeature<T extends Feature>(feature: T): RuntimeFeature<Feature, ENV> {
        let instance = this.features.get(feature);
        if (!instance) {
            instance = feature[CREATE_RUNTIME](this, this.env);
        }
        return instance;
    }

    public async runFeature(feature: Feature): Promise<void> {
        const featureInstance = this.features.get(feature);
        if (!featureInstance) {
            throw new Error('Could not find running feature: ' + feature.id);
        }
        await featureInstance[RUN](this, this.env);
    }

    public async dispose(feature: Feature, envName: string) {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            await runningFeature[DISPOSE](this, envName);
            this.features.delete(feature);
        }
    }

    public getTopLevelConfig(featureId: string, configId: string) {
        return this.topLevelConfigMap[this.entityID(featureId, configId)] || [];
    }

    public entityID(featureId: string, entityKey: string) {
        return `${featureId}.${entityKey}`;
    }

    public getCOM() {
        return this.get(COM);
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
