import type { TopLevelConfig } from '@wixc3/engine-core';
import { IEngineRuntimeArguments } from '@wixc3/engine-core-node';

class RuntimeArgumentsHandler {
    private provider?: () => Promise<IEngineRuntimeArguments>;
    private registeredConfigs = new Set<TopLevelConfig>();

    setProvider(provider: () => Promise<IEngineRuntimeArguments>) {
        this.provider = provider;
    }
    async getRuntimeArguments(): Promise<IEngineRuntimeArguments> {
        if (!this.provider) {
            throw new Error(`runtime arguments provider was not provided at runtime`);
        }
        const runtimeArguments = await this.provider();
        const runtimeConfigs = [...this.registeredConfigs.values()].flat();
        return {
            ...runtimeArguments,
            config: [...runtimeArguments.config, ...runtimeConfigs],
        };
    }
    registerRuntimeConfig(config: TopLevelConfig) {
        this.registeredConfigs.add(config);
    }
    removeRuntimeConfig(config: TopLevelConfig) {
        this.registeredConfigs.delete(config);
    }
}

export default new RuntimeArgumentsHandler();
