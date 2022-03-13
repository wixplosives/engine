import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { Environment, Feature, run as runEngine } from '@wixc3/engine-core';
import { COM, Service } from '@wixc3/engine-com';

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('service with remove access environment visibility', () => {
    it('local services in the same env uses the provided implementation', async () => {
        const processing = new Environment('processing', 'worker', 'multi');
        const main = new Environment('main', 'worker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                echoService: Service.withType<{ echo(s: string): string }>()
                    .defineEntity(processing)
                    .allowRemoteAccess(),
            },
        });

        echoFeature.setup(processing, ({ echoService }) => {
            // this is the proxy! because we did not defined the service yet.
            expect(typeof echoService.get === 'function');

            return {
                echoService: {
                    echo(s: string) {
                        return s;
                    },
                },
            };
        });

        echoFeature.setup(main, ({ echoService }) => {
            // this is the proxy! because we are in different env.
            expect(typeof echoService.get === 'function');
        });

        // const checks = [];
        const testFeature = new Feature({
            id: 'test',
            dependencies: [echoFeature],
            api: {},
        });

        testFeature.setup(processing, ({}, { echoFeature: { echoService } }) => {
            // this is the real service since we are in the same env!.
            expect(typeof echoService.echo === 'function');
        });

        testFeature.setup(main, ({}, { echoFeature: { echoService } }) => {
            // this is the proxy! because we are in different env.
            expect(typeof echoService.get === 'function');
        });

        await runEngine({
            entryFeature: testFeature,
            env: processing,
        });

        await runEngine({
            entryFeature: testFeature,
            env: main,
        });
    });
});

describe.skip('Environments And Entity Visibility (ONLY TEST TYPES)', () => {
    it('allow spawn of new environments and use remote services', () => {
        const main = new Environment('main', 'window', 'single');
        const processing = new Environment('processing', 'worker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                echoService: Service.withType<{ echo(s: string): string }>()
                    .defineEntity(processing)
                    .allowRemoteAccess(),
            },
        });

        echoFeature.setup(processing, () => {
            return {
                echoService: {
                    echo(s: string) {
                        return s;
                    },
                },
            };
        });

        const checks = [];
        const testFeature = new Feature({
            id: 'test',
            dependencies: [echoFeature],
            api: {},
        });

        testFeature.setup(processing, ({ run }, { echoFeature: { echoService } }) => {
            run(() => {
                checks.push(echoService.echo('echo1'));
            });
        });

        testFeature.setup(main, ({ run }, { echoFeature: { echoService } }) => {
            run(async () => {
                const val = await echoService.echo('echo2');
                checks.push(val);
            });
        });
    });
    it('feature remote api should be available inside same feature setup', () => {
        const processing = new Environment('processing', 'worker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                // processing,
                echoService: Service.withType<{ echo(s: string): string }>()
                    .defineEntity(processing)
                    .allowRemoteAccess(),
            },
        });

        echoFeature.setup(processing, ({}, {}) => {
            return {
                echoService: {
                    echo(s: string) {
                        return s;
                    },
                },
            };
        });
    });
});
