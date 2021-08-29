import { Environment, Feature, Service, COM } from '@wixc3/engine-core';
export const MAIN = new Environment('main', 'window', 'single');
export const PROC = new Environment('processing', 'node', 'single');
import type { MyInterfaceClass } from './interface';

export interface Options {
    [key: string]: any;
}

export interface RuntimeOptionsService {
    getOptions: () => Options;
}

export default new Feature({
    id: 'XTestFeature',
    api: {
        passedOptions: Service.withType<MyInterfaceClass>().defineEntity(PROC).allowRemoteAccess(),
    },
    dependencies: [COM],
});
