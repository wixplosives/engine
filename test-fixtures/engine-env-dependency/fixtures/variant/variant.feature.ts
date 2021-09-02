import { Environment, Feature } from '@wixc3/engine-core';
import App, { client } from '../../feature/app.feature';
export const page2 = new Environment('page2', 'window', 'single', [client]);

export default new Feature({
    id: 'engine-env-dependency-user',
    api: {},
    dependencies: [App],
});
