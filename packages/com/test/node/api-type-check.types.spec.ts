import type { EQUAL } from 'typescript-type-utils';
import { Environment, Config, Feature, Registry, Running, Slot } from '@wixc3/engine-core';
import { AsyncApi, Service } from '@wixc3/engine-com';
import { typeCheck } from '../type-check';

/*************** EXAMPLE FEATURE FILES ***************/

const MAIN = new Environment('main', 'window', 'single');
const ZAG = new Environment('zag', 'window', 'single');

const logger = new Feature({
    id: 'logger',
    api: {
        config: Config.withType<{ time: number }>().defineEntity({ time: 1 }),
        transport: Slot.withType<{ transportName: string }>().defineEntity(MAIN),
        sink: Service.withType<{ log: (message: string) => void }>().defineEntity(MAIN).allowRemoteAccess(),
    },
});

typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof logger, typeof MAIN>,
            {
                config: { time: number };
                transport: Registry<{
                    transportName: string;
                }>;
                sink: {
                    log: (message: string) => void;
                };
            }
        >
    ) => true
);

typeCheck(
    (
        _runningFeature: EQUAL<
            Running<typeof logger, typeof ZAG>,
            {
                config: { time: number };

                sink: AsyncApi<{
                    log: (message: string) => void;
                }>;
            }
        >
    ) => true
);

interface SomeApi {
    someMethod: () => boolean;
}

type SomeApiPromisified = AsyncApi<SomeApi>;

typeCheck((_: EQUAL<SomeApiPromisified, { someMethod(): Promise<boolean> }>) => true);
