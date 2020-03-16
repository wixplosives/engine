import { Environment, Feature, windowInitializer } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single', windowInitializer());
export default new Feature({ id: 'TestFeature', api: {} });
