import { BaseHost, Communication, Environment, IRunOptions } from '@wixc3/engine-core';
import { workerThreadInitializer2 } from './worker-thread-initializer2';

interface RunningNodeEnvironment {
    id: string;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
}

export class NodeEnvManager {
    openEnvironments = new Set<RunningNodeEnvironment>();
    constructor(
        private communication = new Communication(new BaseHost(), 'node-environment-manager', {}, {}, true, {})
    ) {}
    async open(env: Environment, workerURL: URL, runtimeOptions: IRunOptions) {
        const runningEnv = workerThreadInitializer2({
            communication: this.communication,
            env,
            workerURL: workerURL,
            argv: new Array(runtimeOptions.entries()).flatMap(([key, value]) => [`--${key}`, String(value)]),
        });
        await runningEnv.initialize();
        this.openEnvironments.add(runningEnv);
        return () => {
            this.openEnvironments.delete(runningEnv);
            return runningEnv.dispose();
        };
    }
}
