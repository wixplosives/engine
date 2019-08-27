import _3rdParty from '@fixture/3rd-party/3rd-party.feature';
import { Config, Feature } from '@wixc3/engine-core';

export interface IDefaultConfig {
    echoText: string;
}

export default new Feature({
    id: 'withConfigs',
    api: {
        config: new Config<IDefaultConfig>({ echoText: 'hello' })
    },
    dependencies: [_3rdParty]
});
