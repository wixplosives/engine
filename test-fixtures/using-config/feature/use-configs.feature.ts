import { Config, Environment, Feature } from '@wixc3/engine-core';

export const main = new Environment('main', 'window', 'single');

export interface IDefaultConfig {
    echoText: string;
}

export default new Feature({
    id: 'withConfigs',
    api: {
        config: new Config<IDefaultConfig>({ echoText: 'hello' }),
    },
});
