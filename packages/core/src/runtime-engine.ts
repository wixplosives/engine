import COM from './communication.feature';
import type { RuntimeFeature, Feature } from './entities';
import { CREATE_RUNTIME, DISPOSE, RUN } from './symbols';
import type { IRunOptions, TopLevelConfig } from './types';

export class RuntimeEngine {
    public features = new Map<Feature, RuntimeFeature>();
    private running = false;
    private topLevelConfigMap: Record<string, object[]>;
    constructor(topLevelConfig: TopLevelConfig = [], public runOptions: IRunOptions = new Map()) {
        this.topLevelConfigMap = this.createConfigMap(topLevelConfig);
    }

    public get<T extends Feature>(feature: T) {
        const runningFeature = this.features.get(feature);
        if (runningFeature) {
            return runningFeature as RuntimeFeature<T, T['dependencies'], T['api']>;
        } else {
            throw new Error('missing feature');
        }
    }

    public run(features: Feature | Feature[], envName: string): RuntimeEngine {
        if (this.running) {
            throw new Error('Engine already running!');
        }
        this.running = true;
        if (!Array.isArray(features)) {
            features = [features];
        }
        for (const feature of features) {
            this.initFeature(feature, envName);
        }
        for (const feature of features) {
            this.runFeature(feature, envName);
        }
        return this;
    }

    public allReady() {
        const readyPromises: Promise<void[]>[] = [];
        for (const [, runtimeFeature] of this.features) {
            readyPromises.push(runtimeFeature.finishedRun());
        }

        return Promise.all(readyPromises);
    }

    public initFeature<T extends Feature>(feature: T, envName: string) {
        let instance = this.features.get(feature);
        if (!instance) {
            instance = feature[CREATE_RUNTIME](this, envName);
        }
        return instance;
    }

    public runFeature(feature: Feature, envName: string) {
        const featureInstance = this.features.get(feature);
        if (!featureInstance) {
            throw new Error('Could not find running feature: ' + feature.id);
        }
        featureInstance[RUN](this, envName);
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
                configMap[key].push(value);
            }
        }
        return configMap;
    }
}
