import { Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export const workerEnv = new Environment('worker', 'workerthread', 'single');

export default new Feature({
    id: 'empty',
    api: {},
    dependencies: [COM.asDependency],
});
