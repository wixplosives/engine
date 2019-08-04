import { Router } from 'express';
import { IRunOptions } from './application';

export interface RunEngineFunction {
    close: () => Promise<void>;
}

export class NodeEnvironmentsManager {
    private runningEnvironmetns = new Map<string, Map<string, RunEngineFunction>>();
    private isClearingAll = false;

    constructor(
        private runNodeEnvironmentFunction: (target: {
            featureName: string;
            configName?: string | undefined;
            projectPath?: string | undefined;
        }) => Promise<RunEngineFunction>
    ) {}

    public async runFeature({ featureName, configName }: IRunOptions) {
        if (this.isClearingAll) {
            throw new Error(`cannot launch new environments, environemnts are being cleand up`);
        }
        if (this.isParametersValid({ featureName, configName })) {
            if (!this.runningEnvironmetns.has(featureName!)) {
                this.runningEnvironmetns.set(featureName!, new Map());
            }
            if (!this.runningEnvironmetns.get(featureName!)!.has(configName!)) {
                this.runningEnvironmetns
                    .get(featureName!)!
                    .set(configName!, await this.runNodeEnvironmentFunction({ featureName: featureName!, configName }));
            } else {
                throw new Error(`node environment for ${featureName} with ${configName} is already running`);
            }
        }
    }

    public async closeFeature({ featureName, configName }: IRunOptions) {
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

    public getRunningFeatures({ featureName, configName }: IRunOptions = {}) {
        if (!featureName) {
            return Array.from(this.runningEnvironmetns.keys()).reduce(
                (prev, runningFeatureName) => {
                    prev[runningFeatureName] = Array.from(this.runningEnvironmetns.get(runningFeatureName)!.keys());
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

    public async closeAll() {
        this.isClearingAll = true;
        for (const [, runningEnvironments] of this.runningEnvironmetns) {
            for (const [, runningEnvironment] of runningEnvironments) {
                await runningEnvironment.close();
            }
        }
        this.runningEnvironmetns.clear();
        this.isClearingAll = false;
    }

    public middlewere() {
        const router = Router();

        router.put('/node-env', async (req, res) => {
            const { configName, featureName }: IRunOptions = req.query;
            try {
                await this.runFeature({ configName, featureName });
                res.json({
                    result: 'success'
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error.message
                });
            }
        });

        router.delete('/node-env', async (req, res) => {
            const { featureName, configName }: IRunOptions = req.query;
            try {
                await this.closeFeature({ configName, featureName });
                res.json({
                    result: 'success'
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error.message
                });
            }
        });

        router.get('/node-env', (req, res) => {
            const { featureName, configName }: IRunOptions = req.query;
            try {
                const data = this.getRunningFeatures({ configName, featureName });
                res.json({
                    result: 'success',
                    data
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error.message
                });
            }
        });

        return router;
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
