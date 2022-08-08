import { COM, Config, Environment, Feature, Slot } from '@wixc3/engine-core';

export const client = new Environment('main', 'window', 'single');
export const iframe = new Environment('iframe', 'iframe', 'single');

export interface AppConfig {
    message: string;
}

export default new Feature({
    id: 'baseApp',
    api: {
        baseAppConfig: Config.withType<AppConfig>().defineEntity({ message: 'this is configurable' }),
        clientSlot: Slot.withType<string>().defineEntity(client),
        iframeSlot: Slot.withType<string>().defineEntity(iframe),
    },
    dependencies: [COM.asEntity],
});
