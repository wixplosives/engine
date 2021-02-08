import { Feature, ExternalDefinition } from '@wixc3/engine-core';
import AFeature from './module-a.feature';

export default new Feature({
    id: 'b',
    api: {},
    dependencies: [AFeature],
});

export const externalModules: ExternalDefinition[] = [
    {
        globalName: 'MyOtherModule',
        request: 'my-other-module',
    },
    { request: 'mod', globalName: 'Mod' },
];

export const externalModule: ExternalDefinition = {
    globalName: 'AnotherOtherModule',
    request: 'another-other-module',
};
