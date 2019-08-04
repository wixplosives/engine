import { Feature } from '@wixc3/engine-core';
import ContextualFeature, { contextualEnv } from '../feature/contextual-with-worker-default.feature';

export default new Feature({
    id: 'serverContextualFeature',
    api: {},
    dependencies: [ContextualFeature]
});

export const Context = contextualEnv.useContext('server');
