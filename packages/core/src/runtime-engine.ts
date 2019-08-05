import COM from './communication.feature';
import { RuntimeFeature } from './entities/feature';
import { CREATE_RUNTIME, DISPOSE, RUN } from './symbols';
import { SomeFeature, SomeRuntimeFeature, TopLevelConfig } from './types';

export class RuntimeEngine {
    public features = new Map<SomeFeature, SomeRuntimeFeature>();
    private running = false;
    private topLevelConfigMap: Record<string, object[]>;
    constructor(topLevelConfig: TopLevelConfig = []) {
        this.topLevelConfigMap = this.createConfigMap(topLevelConfig);
    }

    public get<T extends SomeFeature>(feature: T): RuntimeFeature<T, T['dependencies'], T['api']> {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            return runningFeature;
        } else {
            throw new Error('missing feature');
        }
    }

    public run(features: SomeFeature | SomeFeature[]): RuntimeEngine {
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
        for (const feature of features) {
            this.runFeature(feature);
        }
        return this;
    }

    public initFeature<T extends SomeFeature>(feature: T) {
        let instance = this.features.get(feature);
        if (!instance) {
            instance = feature[CREATE_RUNTIME](this);
        }
        return instance;
    }

    public runFeature(feature: SomeFeature) {
        const featureInstance = this.features.get(feature);
        if (!featureInstance) {
            throw new Error('Could not find running feature: ' + feature.id);
        }
        featureInstance[RUN](this);
    }

    public async dispose(feature: SomeFeature) {
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

    public getCOM() {
        return this.get(COM);
    }

    private createConfigMap(topLevelConfig: TopLevelConfig) {
        const configMap: Record<string, object[]> = {};
        for (const [featureId, multiValue] of topLevelConfig) {
            for (const [configId, value] of Object.entries(multiValue)) {
                const key = this.entityID(featureId, configId);
                configMap[key] = configMap[key] || [];
                configMap[key].push(value);
            }
        }
        return configMap;
    }
}
