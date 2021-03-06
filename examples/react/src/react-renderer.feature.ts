import { Environment, Feature, Service } from '@wixc3/engine-core';
import type React from 'react';

export const MainEnv = new Environment('main', 'window', 'single');

export default new Feature({
    id: 'renderer',
    api: {
        renderingService: Service.withType<{ render: (e: React.FunctionComponent) => void }>().defineEntity(MainEnv),
    },
});
