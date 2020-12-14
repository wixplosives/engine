import { serverEnv } from '@fixture/engine-node/feature/x.feature';
import { COM, Environment, Feature, Service, Slot } from '@wixc3/engine-core';

export const client = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'baseApp',
    api: {
        clientSlot: Slot.withType<string>().defineEntity(client),
        serverSlot: Slot.withType<string>().defineEntity(server),
        dataProvider: Service.withType<{ getData(): string[] }>().defineEntity(serverEnv).allowRemoteAccess(),
    },
    dependencies: [COM],
});
