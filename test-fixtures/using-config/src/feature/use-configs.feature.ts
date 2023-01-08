import { Config, Environment, EngineFeature } from '@wixc3/engine-core';

export const main = new Environment('main', 'window', 'single');

export interface IDefaultConfig {
    echoText: string;
}

export default class WithConfigs extends EngineFeature<'withConfigs'> {
    id = 'withConfigs' as const;
    api = {
        config: new Config<IDefaultConfig>({ echoText: 'hello' }),
    };
}
