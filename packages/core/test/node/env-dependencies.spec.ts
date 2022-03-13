import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { Environment, Feature, run as runEngine, Value } from '@wixc3/engine-core';
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
                service: Value.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Value.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
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
                service: Value.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Value.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
            },
        });
        const extendingFeature = new Feature({
            id: 'extending',
            api: {
                service: Value.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2: Value.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
            },
            dependencies: [entryFeature],
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
                service1: Value.withType<EchoService>().defineEntity(env1),
                service2: Value.withType<EchoService>().defineEntity(env2),
                service3: Value.withType<EchoService>().defineEntity(env3),
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
            dependencies: [entryFeature],
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
});
