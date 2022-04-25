import { Environment, Feature } from '@wixc3/engine-core';
import { Service, AsyncApi, EnvironmentInstanceToken } from '@wixc3/engine-com';
import { typeCheck } from '@wixc3/engine-core/test/type-check';
import type { EQUAL } from 'typescript-type-utils';

/** type check only test */
describe.skip('ENV dependencies', () => {
    it('env dependency preserve multi when accessing from other env', () => {
        const baseEnv = new Environment('baseEnv', 'node', 'multi');
        const extendingEnv = new Environment('extendingEnv', 'node', 'multi', [baseEnv]);

        const entryFeature = new Feature({
            id: 'test',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>()
                    .defineEntity(baseEnv)
                    .allowRemoteAccess(),
                service2: Service.withType<{ multiplyThenIncrement: (n: number) => number }>()
                    .defineEntity(extendingEnv)
                    .allowRemoteAccess(),
            },
        });

        const otherEnv = new Environment('otherEnv', 'node', 'single');
        entryFeature.setup(otherEnv, (entry) => {
            typeCheck(
                (
                    _runningFeature: EQUAL<
                        typeof entry['service'],
                        {
                            get(token: EnvironmentInstanceToken): AsyncApi<{ increment: (n: number) => number }>;
                        }
                    >
                ) => true
            );
            typeCheck(
                (
                    _runningFeature: EQUAL<
                        typeof entry['service2'],
                        {
                            get(
                                token: EnvironmentInstanceToken
                            ): AsyncApi<{ multiplyThenIncrement: (n: number) => number }>;
                        }
                    >
                ) => true
            );
        });
    });
});
