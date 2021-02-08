import { Feature, ExternalDefinition } from '@wixc3/engine-core';

export default new Feature({
    id: 'a',
    api: {},
});

export const externalModule: ExternalDefinition = {
    globalName: 'MyModule',
    request: 'my-module',
};
