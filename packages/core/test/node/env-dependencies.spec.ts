import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { Environment, Feature, run as runEngine, Service } from '@wixc3/engine-core';

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('ENV dependencies', () => {
    it('simple env dependency', async () => {
        const baseEnv = new Environment('baseEnv', 'node', 'multi');
        const extendingEnv = new Environment('extendingEnv', 'node', 'multi', [baseEnv]);
        const entryFeature = new Feature({
            id: 'test',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2:
                    Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
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
        const engine = await runEngine<typeof extendingEnv>({ entryFeature, env: extendingEnv });
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
                service2:
                    Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
            },
        });
        const extendingFeature = new Feature({
            id: 'extending',
            api: {
                service: Service.withType<{ increment: (n: number) => number }>().defineEntity(baseEnv),
                service2:
                    Service.withType<{ multiplyThenIncrement: (n: number) => number }>().defineEntity(extendingEnv),
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
        extendingFeature.setup(extendingEnv, ({}, { entry: { service, service2 } }) => {
            console.log(service.increment(2));
            return {
                service2,
            };
        });
        const engine = await runEngine<typeof extendingEnv>({ entryFeature, env: extendingEnv });
        const runningFeature = engine.get(entryFeature);

        expect(runningFeature.api.service2.multiplyThenIncrement(5)).to.equal(11);
        expect(runningFeature.api.service.increment(5)).to.equal(6);
    });
});
