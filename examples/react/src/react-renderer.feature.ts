import { Environment, Feature, Service } from '@wixc3/engine-core';

export const MainEnv = new Environment('main', 'window', 'single');

export default new Feature({
    id: 'renderer',
    api: {
        renderingService: Service.withType<{ render: (e: any) => void }>().defineEntity(MainEnv),
    },
});
