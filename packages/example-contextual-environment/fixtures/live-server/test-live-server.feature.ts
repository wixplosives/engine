import { Feature } from '@wixc3/engine-core';
import ContextualFeature, { processingEnv } from '../../feature/contextual.feature';

export default new Feature({
    id: 'use-local-server-example',
    dependencies: [ContextualFeature],
    api: {}
});

export const Context = processingEnv.useContext('live-server');
