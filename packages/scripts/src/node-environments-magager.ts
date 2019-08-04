import { Router } from 'express';
import { IRunOptions } from './application';

export interface RunEngineFunction {
    close: () => Promise<void>;
}

export class NodeEnvironmentsManager {
    private runningEnvironments = new Map<string, RunEngineFunction>();
    private isClearingAll = false;

    constructor(
        private runNodeEnvironmentFunction: (target: {
            featureName: string;
            configName?: string | undefined;
            projectPath?: string | undefined;
        }) => Promise<RunEngineFunction>
    ) {}

    public async runFeature({ featureName, configName }: IRunOptions) {
        if (!featureName) {
            throw new Error('feature name was not provided');
        }
        if (this.isClearingAll) {
            throw new Error(`cannot launch new environments, environemnts are being cleand up`);
        }
        if (this.runningEnvironments.has(featureName!)) {
            throw new Error(`node environment for ${featureName} already running`);
        }
        if (!this.runningEnvironments.has(featureName!)) {
            this.runningEnvironments.set(
                featureName!,
                await this.runNodeEnvironmentFunction({ featureName: featureName!, configName })
            );
        }
    }

    public async closeFeature({ featureName }: IRunOptions) {
        if (!featureName) {
            throw new Error('feature name was not provided');
        }
        if (!this.runningEnvironments.has(featureName!)) {
            throw new Error(`there are no node environments running for ${featureName}`);
        }
        const runningFeatureEnvironments = this.runningEnvironments.get(featureName!)!;
        await runningFeatureEnvironments.close();
        this.runningEnvironments.delete(featureName!);
    }

    public getRunningFeatures({ featureName }: IRunOptions = {}) {
        if (!featureName) {
            return Array.from(this.runningEnvironments.keys());
        }
        const runningFeature = this.runningEnvironments.get(featureName);
        if (!runningFeature) {
            throw new Error(`there are no node environment running for ${featureName} feature`);
        }
        return;
    }

    public async closeAll() {
        this.isClearingAll = true;
        for (const [, runningEnvironment] of this.runningEnvironments) {
            await runningEnvironment.close();
        }
        this.runningEnvironments.clear();
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
            const { featureName }: IRunOptions = req.query;
            try {
                await this.closeFeature({ featureName });
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
}
