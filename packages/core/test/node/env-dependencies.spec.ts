import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import {
    AsyncApi,
    BaseHost,
    COM,
    Environment,
    EnvironmentInstanceToken,
    Feature,
    MultiEnvAsyncApi,
    run as runEngine,
    Service,
} from '@wixc3/engine-core';
import { typeCheck } from '../type-check';
import type { EQUAL } from 'typescript-type-utils';

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('ENV dependencies', () => {
    it('simple env dependency', async () => {
        const baseEnv = new Environment('baseEnv', 'node', 'multi', []);
        const extendingEnv = new Environment('extendingEnv', 'node', 'multi', [baseEnv]);
        const entryFeature = new Feature({
            id: 'test',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(
                    extendingEnv
                ),
            },
        });

        entryFeature.setup(baseEnv, ({}) => {
            return {
                service: {
                    increment: (n) => n + 1,
                },
            };
        });
        entryFeature.setup(extendingEnv, ({ service }) => {
            return {
                service2: {
                    multiplyThenIncrement: (n) => service.increment(n * 2),
                },
            };
        });
        const engine = await runEngine({ entryFeature, env: extendingEnv });
        const runningFeature = engine.get(entryFeature);

        expect(runningFeature.api.service2.multiplyThenIncrement(5)).to.equal(11);
        expect(runningFeature.api.service.increment(5)).to.equal(6);
    });
    it('env and feature dependency dependency', async () => {
        const baseEnv = new Environment('baseEnv', 'node', 'multi');
        const extendingEnv = new Environment('extendingEnv', 'node', 'multi', [baseEnv]);
        const entryFeature = new Feature({
            id: 'entry',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(
                    extendingEnv
                ),
            },
        });
        const extendingFeature = new Feature({
            id: 'extending',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(
                    extendingEnv
                ),
            },
            dependencies: [entryFeature.asDependency],
        });
        entryFeature.setup(baseEnv, ({}) => {
            return {
                service: {
                    increment: (n) => n + 1,
                },
            };
        });
        extendingFeature.setup(baseEnv, ({}, { entry: { service } }) => {
            return {
                service,
            };
        });

        entryFeature.setup(extendingEnv, ({ service }) => {
            return {
                service2: {
                    multiplyThenIncrement: (n) => service.increment(n * 2),
                },
            };
        });
        extendingFeature.setup(extendingEnv, ({}, { entry: { service: entryService, service2 } }) => {
            console.log(entryService.increment(2));
            return {
                service2,
            };
        });
        const engine = await runEngine({ entryFeature, env: extendingEnv });
        const runningFeature = engine.get(entryFeature);

        expect(runningFeature.api.service2.multiplyThenIncrement(5)).to.equal(11);
        expect(runningFeature.api.service.increment(5)).to.equal(6);
    });
    it('deep environment dependencies', async () => {
        const env1 = new Environment('env1', 'node', 'multi');
        const env2 = new Environment('env2', 'node', 'multi', [env1]);
        const env3 = new Environment('env3', 'node', 'multi', [env2]);

        type EchoService = {
            echo: (n: string) => string;
        };

        const entryFeature = new Feature({
            id: 'entry',
            api: {
                service1: Service.withType<EchoService>().defineEntity(env1),
                service2: Service.withType<EchoService>().defineEntity(env2),
                service3: Service.withType<EchoService>().defineEntity(env3),
            },
        });

        entryFeature.setup(env1, ({}) => {
            return {
                service1: {
                    echo: (val) => `env1 ${val}`,
                },
            };
        });
        entryFeature.setup(env2, ({}) => {
            return {
                service2: {
                    echo: (val) => `env2 ${val}`,
                },
            };
        });

        entryFeature.setup(env3, ({}) => {
            return {
                service3: {
                    echo: (val) => `env3 ${val}`,
                },
            };
        });

        const engine = await runEngine({ entryFeature, env: env3 });
        const runningFeature = engine.get(entryFeature);
        expect(runningFeature.api.service1.echo('Test')).to.equal('env1 Test');
        expect(runningFeature.api.service2.echo('Test')).to.equal('env2 Test');
        expect(runningFeature.api.service3.echo('Test')).to.equal('env3 Test');

        new Feature({
            id: 'testFeatureDeps',
            dependencies: [entryFeature.asDependency],
            api: {},
        }).setup(env3, ({}, { entry }) => {
            // We only asset that the types are correct feature runtime does not care.
            typeCheck(
                (
                    _runningFeature: EQUAL<
                        typeof entry,
                        {
                            service1: EchoService;
                            service2: EchoService;
                            service3: EchoService;
                        }
                    >
                ) => true
            );
        });
    });
    it('env dependency preserve multi when accessing from other env', async () => {
        const baseEnv = new Environment('baseEnv', 'node', 'multi');
        const extendingEnv = new Environment('extendingEnv', 'node', 'multi', [baseEnv]);
        const otherEnv = new Environment('otherEnv', 'node', 'single');

        const entryFeature = new Feature({
            id: 'test',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>()
                    .defineEntity(baseEnv)
                    .allowRemoteAccess(),
                service2: Service.withType<{ multiplyThenIncrement: (n: number) => number }>()
                    .defineEntity(extendingEnv)
                    .allowRemoteAccess(),
                caller: Service.withType<{ multiplyThenIncrement: (n: number) => Promise<number> }>().defineEntity(
                    otherEnv
                ),
            },
            dependencies: [COM.asDependency],
        });

        entryFeature.setup(baseEnv, (entry) => {
            typeCheck(
                (_service: EQUAL<(typeof entry)['service'], MultiEnvAsyncApi<{ increment: (n: number) => number }>>) =>
                    true
            );
            typeCheck(
                (
                    _service2: EQUAL<
                        (typeof entry)['service2'],
                        {
                            get(
                                token: EnvironmentInstanceToken
                            ): AsyncApi<{ multiplyThenIncrement: (n: number) => number }>;
                        }
                    >
                ) => true
            );

            return {
                service: {
                    increment(n) {
                        return n + 1;
                    },
                },
            };
        });
        entryFeature.setup(extendingEnv, (entry) => {
            typeCheck((_service: EQUAL<(typeof entry)['service'], { increment: (n: number) => number }>) => true);
            typeCheck(
                (
                    _service2: EQUAL<
                        (typeof entry)['service2'],
                        {
                            get(
                                token: EnvironmentInstanceToken
                            ): AsyncApi<{ multiplyThenIncrement: (n: number) => number }>;
                        }
                    >
                ) => true
            );

            return {
                service2: {
                    multiplyThenIncrement(n) {
                        return entry.service.increment(n * 2);
                    },
                },
            };
        });
        const otherEnvHost = new BaseHost();
        const extEnvHost = otherEnvHost.open();

        await runEngine({
            entryFeature,
            env: extendingEnv,
            topLevelConfig: [
                COM.use({
                    config: {
                        host: extEnvHost,
                    },
                }),
            ],
        });

        entryFeature.setup(otherEnv, (entry) => {
            typeCheck(
                (_service: EQUAL<(typeof entry)['service'], MultiEnvAsyncApi<{ increment: (n: number) => number }>>) =>
                    true
            );
            typeCheck(
                (
                    _service2: EQUAL<
                        (typeof entry)['service2'],
                        {
                            get(
                                token: EnvironmentInstanceToken
                            ): AsyncApi<{ multiplyThenIncrement: (n: number) => number }>;
                        }
                    >
                ) => true
            );
            return {
                caller: {
                    multiplyThenIncrement(n) {
                        return entry.service2.get({ id: extEnvHost.name }).multiplyThenIncrement(n);
                    },
                },
            };
        });
        const runnningOtherEnv = await runEngine({
            entryFeature,
            env: otherEnv,
            topLevelConfig: [
                COM.use({
                    config: {
                        host: otherEnvHost,
                    },
                }),
            ],
        });

        runnningOtherEnv.get(COM).api.communication.registerEnv(extendingEnv.env, extEnvHost);
        const res = await runnningOtherEnv.get(entryFeature).api.caller.multiplyThenIncrement(3);
        expect(res).to.equal(7);
    });
});
