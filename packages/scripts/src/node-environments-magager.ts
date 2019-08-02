import { IRunOptions } from './application';

export type RunEngineFunction = {
    close: () => Promise<void>;
};

export class NodeEnvironmentsManager {
    private runningEnvironmetns = new Map<string, Map<string, RunEngineFunction>>();

    constructor(
        private runEngine: (target: {
            featureName: string;
            configName?: string | undefined;
            projectPath?: string | undefined;
        }) => Promise<RunEngineFunction>
    ) {}

    async runFeature({ featureName, configName }: IRunOptions) {
        if (this.isParametersValid({ featureName, configName })) {
            if (!this.runningEnvironmetns.has(featureName!)) {
                this.runningEnvironmetns.set(featureName!, new Map());
            }
            if (!this.runningEnvironmetns.get(featureName!)!.has(configName!)) {
                this.runningEnvironmetns
                    .get(featureName!)!
                    .set(configName!, await this.runEngine({ featureName: featureName!, configName }));
            } else {
                throw new Error(`node environment for ${featureName} with ${configName} is already running`);
            }
        }
    }

    async closeFeature({ featureName, configName }: IRunOptions) {
        if (this.isParametersValid({ featureName, configName })) {
            if (!this.runningEnvironmetns.has(featureName!)) {
                throw new Error(`there are no node environments running for ${featureName}`);
            }
            if (!this.runningEnvironmetns.get(featureName!)!.has(configName!)) {
                throw new Error(`there are no node environment running for ${featureName} with ${configName} config`);
            }
            const runningFeatureEnvironments = this.runningEnvironmetns.get(featureName!)!;
            await runningFeatureEnvironments.get(configName!)!.close();
            this.runningEnvironmetns.get(featureName!)!.delete(configName!);
        }
    }

    getRunningFeatures({ featureName, configName }: IRunOptions = {}) {
        if (!featureName) {
            return Array.from(this.runningEnvironmetns.keys()).reduce(
                (prev, runningFeature) => {
                    prev[runningFeature] = Array.from(this.runningEnvironmetns.get(runningFeature)!.keys());
                    return prev;
                },
                {} as Record<string, string[]>
            );
        }
        const runningFeature = this.runningEnvironmetns.get(featureName);
        if (!runningFeature) {
            throw new Error(`there are no node environment running for ${featureName} with ${configName} config`);
        } else if (!configName) {
            return Array.from(runningFeature.keys());
        } else {
            const runningFeatureForConfig = runningFeature.get(configName);
            if (!runningFeatureForConfig) {
                throw new Error(`there are no node environment running for ${featureName} with ${configName} config`);
            }
        }
        return;
    }

    private isParametersValid({ featureName, configName }: IRunOptions) {
        if (!featureName) {
            throw new Error('feature name was not provided');
        }
        if (!configName) {
            throw new Error('config name was not provided');
        }
        return true;
    }
}
