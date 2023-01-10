import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spy } from 'sinon';
import sinonChai from 'sinon-chai';
import type { EQUAL } from 'typescript-type-utils';
import {
    AllEnvironments,
    COM,
    Config,
    CREATE_RUNTIME,
    DisposeFunction,
    Environment,
    Feature,
    FeatureInput,
    IDENTIFY_API,
    IRunOptions,
    MapSlot,
    REGISTER_VALUE,
    run as runEngine,
    RUN_OPTIONS,
    RuntimeEngine,
    Service,
    SingleEndpointContextualEnvironment,
    Slot,
    Universal,
    ENGINE,
} from '@wixc3/engine-core';
import { typeCheck } from '../type-check';

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Feature', () => {
    it('single feature entry', async () => {
        const entryFeature = new Feature({
            id: 'test',
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test' }),
            },
        });

        const engine = await runEngine({ entryFeature, env: AllEnvironments });
        expect(engine.get(entryFeature).api.config.name).to.be.equal('test');
    });

    it('single feature entry with dependencies', async () => {
        const f1 = new Feature({
            id: 'test1',
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test1' }),
            },
        });

        const f2 = new Feature({
            id: 'test2',
            dependencies: [f1.asDependency],
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test2' }),
            },
        });
        const engine = await runEngine({
            entryFeature: [f1, f2],
            env: AllEnvironments,
        });

        expect(engine.get(f1).api.config.name).to.equal('test1');
        expect(engine.get(f2).api.config.name).to.equal('test2');
    });

    it('feature run stage', async () => {
        const f0 = new Feature({ id: 'test', api: {} });
        const entryFeature = new Feature({ id: 'test', api: {}, dependencies: [f0.asDependency] });
        const calls: string[] = [];

        f0.setup(AllEnvironments, ({ run }) => {
            run(() => {
                calls.push('f0 run');
            });
        });

        entryFeature.setup(AllEnvironments, ({ run }) => {
            run(() => {
                calls.push('f1 run');
            });
        });

        await runEngine({ entryFeature, env: AllEnvironments });

        expect(calls).to.eql(['f0 run', 'f1 run']);
    });

    it('feature setup/run stage should not happen twice', async () => {
        const f0 = new Feature({ id: 'test', api: {} });
        const f1 = new Feature({ id: 'test', api: {}, dependencies: [f0.asDependency] });
        const calls: string[] = [];

        f0.setup(AllEnvironments, ({ run }) => {
            calls.push('f0 setup');
            run(() => {
                calls.push('f0 run');
            });
        });

        f1.setup(AllEnvironments, ({ run }) => {
            calls.push('f1 setup');
            run(() => {
                calls.push('f1 run');
            });
        });

        await runEngine({ entryFeature: [f0, f1, f0, f1], env: AllEnvironments });

        expect(calls).to.eql(['f0 setup', 'f1 setup', 'f0 run', 'f1 run']);
    });

    it('feature setup/run stage should happen per environment', async () => {
        const spyEnvOne = spy();
        const spyEnvTwo = spy();
        const oneEnv = new Environment('one', 'node', 'single');
        const twoEnv = new Environment('two', 'node', 'single');
        const entryFeature = new Feature({ id: 'test', api: {} });
        entryFeature.setup(oneEnv, spyEnvOne);
        entryFeature.setup(twoEnv, spyEnvTwo);
        await runEngine({ entryFeature, env: oneEnv });
        expect(spyEnvOne).to.have.callCount(1);
        expect(spyEnvTwo).to.have.callCount(0);
    });

    it('feature should provide requirements (outputs) of each environment', async () => {
        const MAIN1 = new Environment('main1', 'window', 'single');

        const f0 = new Feature({
            id: 'test',
            api: {
                service1: Service.withType<{ echo(x: string): string }>().defineEntity(Universal),
                service2: Service.withType<{ echo(x: string): string }>().defineEntity(MAIN1),
            },
        });

        f0.setup(Universal, () => {
            return {
                service1: {
                    echo(x: string) {
                        return x + '-main1';
                    },
                },
            };
        });

        f0.setup(MAIN1, () => {
            return {
                service2: {
                    echo(x: string) {
                        return x + '-main2';
                    },
                },
            };
        });
        const engine = await runEngine({ entryFeature: [f0], env: MAIN1 });
        const { service1, service2 } = engine.get(f0).api;
        expect(service1.echo('ECHO')).to.eql('ECHO-main1');
        expect(service2.echo('ECHO')).to.eql('ECHO-main2');
    });

    it('feature should throw if setup is called with same environment twice', () => {
        const mainEnv = new Environment('main1', 'window', 'single');

        const f0 = new Feature({
            id: 'test',
            api: {
                service1: Service.withType<{ echo(x: string): string }>().defineEntity(mainEnv),
            },
        });
        expect(() => {
            f0.setup(mainEnv, () => {
                return {
                    service1: {
                        echo(x: string) {
                            return x + '-main1';
                        },
                    },
                };
            });

            f0.setup(mainEnv, () => {
                return {
                    service1: {
                        echo(x: string) {
                            return x + '-main2';
                        },
                    },
                };
            });
        }).to.throw('Feature can only have single setup for each environment.');
    });

    it('Universal input apis should be available universally', async () => {
        const env = new Environment('main', 'window', 'single');

        const f0 = new Feature({
            id: 'test',
            api: {
                slot1: Slot.withType<{ echo(x: string): string }>().defineEntity(Universal),
                service1: Service.withType<{ echo(x: string): string }>().defineEntity(Universal),
                service2: Service.withType<{ echo(x: string): string }>().defineEntity(env),
            },
        });
        f0.setup(Universal, ({ slot1 }) => {
            return {
                service1: {
                    echo(x: string) {
                        return `${x}-${[...slot1].length}`;
                    },
                },
            };
        });
        f0.setup(env, ({ service1, slot1 }) => {
            return {
                service2: {
                    echo(x: string) {
                        return `${service1.echo(x)}-main2-${[...slot1].length}`;
                    },
                },
            };
        });
        const engine = await runEngine({ entryFeature: [f0], env });
        const { slot1, service1, service2 } = engine.get(f0).api;
        expect([...slot1].length).to.eql(0);
        expect(service1.echo('ECHO')).to.eql('ECHO-0');
        expect(service2.echo('ECHO')).to.eql('ECHO-0-main2-0');
    });

    describe('Feature Config', () => {
        it('support multiple top level partial configs', async () => {
            const entryFeature = new Feature({
                id: 'test',
                api: {
                    config: Config.withType<{ a: string; b: string; c: number[] }>().defineEntity({
                        a: '',
                        b: '',
                        c: [],
                    }),
                },
            });

            const engine = await runEngine({
                entryFeature,
                topLevelConfig: [
                    entryFeature.use({
                        config: { a: 'a' },
                    }),
                    entryFeature.use({
                        config: { b: 'b', c: [1] },
                    }),
                ],
                env: AllEnvironments,
            });

            expect(engine.get(entryFeature).api.config).to.be.eql({
                a: 'a',
                b: 'b',
                c: [1],
            });
        });

        it('support config merger', async () => {
            const entryFeature = new Feature({
                id: 'test',
                api: {
                    config: Config.withType<{ a: string; b: string; c: number[] }>().defineEntity(
                        { a: '', b: '', c: [] },
                        (a, b) => {
                            return {
                                a: a.a || b.a || '',
                                b: a.b || b.b || '',
                                c: a.c.concat(b.c || []),
                            };
                        }
                    ),
                },
            });

            const engine = await runEngine({
                entryFeature,
                topLevelConfig: [
                    entryFeature.use({
                        config: { a: 'a', c: [1] },
                    }),
                    entryFeature.use({
                        config: { b: 'b', c: [2] },
                    }),
                ],
                env: AllEnvironments,
            });

            expect(engine.get(entryFeature).api.config).to.be.eql({
                a: 'a',
                b: 'b',
                c: [1, 2],
            });
        });
    });

    describe('Support Map Slots', () => {
        it('single feature that supports map slots', async () => {
            const mainEnv = new Environment('main', 'node', 'single');
            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity(mainEnv),
                    retrieveService: Service.withType<{ getValue(key: string): string | undefined }>().defineEntity(
                        mainEnv
                    ),
                },
            }).setup(mainEnv, ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        },
                    },
                };
            });

            const entryFeature = new Feature({
                id: 'testSlotsSecondFeature',
                api: {},
                dependencies: [maps.asDependency],
            }).setup(mainEnv, ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('1', 'test');
                mapSlot.register('2', 'test2');
            });

            const engine = await runEngine({ entryFeature, env: mainEnv });
            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal('test');
        });

        it('two features that adds to slots', async () => {
            const mainEnv = new Environment('main', 'node', 'single');

            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity(mainEnv),
                    retrieveService: Service.withType<{ getValue(key: string): string | undefined }>().defineEntity(
                        mainEnv
                    ),
                },
            }).setup(mainEnv, ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        },
                    },
                };
            });

            const f1 = new Feature({
                id: 'testSlotsFirstFeature',
                api: {},
                dependencies: [maps.asDependency],
            }).setup(mainEnv, ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('1', 'test');
                mapSlot.register('2', 'test2');
            });

            const f2 = new Feature({
                id: 'testSlotsSecondFeature',
                api: {},
                dependencies: [maps.asDependency],
            }).setup(mainEnv, ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('2', 'test2');
            });

            const engine = await runEngine({ entryFeature: [f1, f2], env: mainEnv });
            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal('test');
            expect(engine.get(maps).api.retrieveService.getValue('2')).to.be.equal('test2');
        });

        it('try to get value from the slot, when the key is not in the map', async () => {
            const mainEnv = new Environment('main', 'node', 'single');
            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity(mainEnv),
                    retrieveService: Service.withType<{ getValue(key: string): string | undefined }>().defineEntity(
                        mainEnv
                    ),
                },
            }).setup(mainEnv, ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        },
                    },
                };
            });

            const entryFeature = new Feature({
                id: 'testSlotsFirstFeature',
                api: {},
                dependencies: [maps.asDependency],
            }).setup(mainEnv, () => undefined);
            const engine = await runEngine({ entryFeature, env: mainEnv });

            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal(undefined);
        });
    });

    describe('Identifiable entities', () => {
        interface Identity {
            featureID: string;
            entityKey: string;
        }
        class Identifiable extends FeatureInput<Readonly<Identity>, Environment, any> {
            public identity!: Identity;
            constructor() {
                super(Universal, Universal);
            }
            public [IDENTIFY_API](featureID: string, entityKey: string) {
                this.identity = {
                    entityKey,
                    featureID,
                };
            }
            public [CREATE_RUNTIME](_context: RuntimeEngine, featureID: string, entityKey: string) {
                return {
                    featureID,
                    entityKey,
                };
            }

            public [REGISTER_VALUE](
                _context: RuntimeEngine,
                _providedValue: undefined,
                inputValue: any,
                _featureID: string,
                _entityKey: string
            ) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return inputValue;
            }

            public getIdentity() {
                return this.identity;
            }
        }
        it('when creating a new feature the APIs should be identified ', () => {
            const ids = new Feature({
                id: 'testIdentify',
                api: {
                    identifiable: new Identifiable(),
                },
            });

            expect(ids.api.identifiable.getIdentity()).to.be.eql({
                featureID: 'testIdentify',
                entityKey: 'identifiable',
            });
        });
    });
});

describe('feature interaction', () => {
    it('should run engine with two features interacting', async () => {
        const mainEnv = new Environment('main', 'node', 'single');
        const echoFeature = new Feature({
            id: 'echoFeature',
            api: {
                transformers: Slot.withType<(s: string) => string>().defineEntity(mainEnv),
                echoService: Service.withType<{ echo(s: string): string }>().defineEntity(mainEnv),
            },
        }).setup(mainEnv, ({ transformers }) => {
            return {
                echoService: {
                    echo(s: string) {
                        return [...transformers].reduce((item, transformer) => {
                            return transformer(item);
                        }, s);
                    },
                },
            };
        });

        ////////////////////////////////////////////////////////

        const entryFeature = new Feature({
            id: 'feature2',
            dependencies: [echoFeature.asDependency],
            api: {
                config: Config.withType<{ prefix: string; suffix: string }>().defineEntity({ prefix: '', suffix: '' }),
            },
        }).setup(mainEnv, ({ config }, { echoFeature: { transformers } }) => {
            transformers.register((s: string) => {
                return `${config.prefix}${s}${config.suffix}`;
            });
        });

        const engine = await runEngine({
            entryFeature,
            topLevelConfig: [
                entryFeature.use({
                    config: { prefix: '!' },
                }),
                entryFeature.use({
                    config: { suffix: '?' },
                }),
            ],
            env: mainEnv,
        });

        expect(engine.get(echoFeature).api.echoService.echo('yoo')).to.be.equal('!yoo?');
    });
});

describe('Contextual environments', () => {
    it('Feature should define contextual environment, set up the environment context and use it in the environment setup', async () => {
        const workerEnv = new Environment('webworker', 'webworker', 'single');
        const processing = new SingleEndpointContextualEnvironment('processing', [workerEnv]);

        interface IProcessingContext {
            name: string;
        }

        const entryFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM.asDependency],
            api: {
                echoService: Service.withType<{ echo(s: string): string }>().defineEntity(processing),
            },
            context: {
                processingContext: processing.withContext<IProcessingContext>(),
                processingContext2: processing.withContext<{ age: number }>(),
            },
        });

        entryFeature.setupContext(processing, 'processingContext', () => {
            return {
                name: 'test',
            };
        });

        entryFeature.setupContext(processing, 'processingContext2', () => {
            return {
                age: 1,
            };
        });

        entryFeature.setup(processing, ({}, {}, { processingContext: { name }, processingContext2: { age } }) => {
            return {
                echoService: {
                    echo(s: string) {
                        return `${s} ${name} ${age}`;
                    },
                },
            };
        });

        const engine = await runEngine({ entryFeature, env: processing });

        expect(engine.get(entryFeature).api.echoService.echo('hello')).to.eq('hello test 1');
    });
});

describe('feature disposal', () => {
    it('disposes a feature on engine dispose call', async () => {
        const envName = 'main';
        const mainEnv = new Environment(envName, 'window', 'single');
        const entryFeature = new Feature({
            id: 'test',
            api: {},
        });
        const dispose = spy(() => Promise.resolve());
        entryFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(dispose);
        });

        const engine = await runEngine({
            entryFeature,
            env: mainEnv,
        });

        await engine.dispose(entryFeature);

        expect(dispose).to.have.have.callCount(1);
    });

    it('allows feature to register to onDispose several times', async () => {
        const envName = 'main';
        const mainEnv = new Environment(envName, 'window', 'single');
        const entryFeature = new Feature({
            id: 'test',
            api: {},
        });
        const dispose = spy(() => Promise.resolve());
        const dispose2 = spy(() => Promise.resolve());

        entryFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(dispose);
            onDispose(dispose2);
        });

        const engine = await runEngine({
            entryFeature,
            env: mainEnv,
        });

        await engine.dispose(entryFeature);

        expect(dispose).to.have.have.callCount(1);
        expect(dispose2).to.have.have.callCount(1);
    });

    it('throws an error if on of the onDispose functiones was rejected', async () => {
        const envName = 'main';
        const mainEnv = new Environment(envName, 'window', 'single');
        const entryFeature = new Feature({
            id: 'test',
            api: {},
        });
        const disposeFirst = spy(() => Promise.resolve());
        const disposeSecond = spy(() => Promise.reject('err'));

        entryFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(disposeFirst);
            onDispose(disposeSecond);
        });

        const engine = await runEngine({
            entryFeature,
            env: mainEnv,
        });

        await expect(engine.dispose(entryFeature)).to.be.rejectedWith('err');

        expect(disposeFirst).to.have.have.callCount(1);
        expect(disposeSecond).to.have.have.callCount(1);
    });

    it('disposes a feature only once', async () => {
        const envName = 'main';
        const mainEnv = new Environment(envName, 'window', 'single');
        const entryFeature = new Feature({
            id: 'test',
            api: {},
        });
        const dispose = spy(() => new Promise((res) => setTimeout(res, 0)));
        entryFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(dispose);
        });

        const engine = await runEngine({
            entryFeature,
            env: mainEnv,
        });

        await Promise.all([engine.dispose(entryFeature), engine.dispose(entryFeature)]);

        expect(dispose).to.have.have.callCount(1);
    });
});

describe('service with remove access environment visibility', () => {
    it('local services in the same env uses the provided implementation', async () => {
        const processing = new Environment('processing', 'webworker', 'multi');
        const main = new Environment('main', 'webworker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM.asDependency],
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
            dependencies: [echoFeature.asDependency],
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
    it('should verify visibility of slots', () => {
        const main = new Environment('main', 'window', 'single');
        const processing = new Environment('processing', 'webworker', 'single');

        new Feature({
            id: 'echoFeature',
            dependencies: [COM.asDependency],
            api: {
                slot: Slot.withType<{ name: string }>().defineEntity(main),
            },
        })
            .setup(main, ({ slot }) => {
                slot.register({ name: 'test' });
            })
            .setup(processing, (feature) => {
                const engine = feature[ENGINE];

                typeCheck(
                    (
                        _noSlot: EQUAL<
                            typeof feature,
                            {
                                id: 'echoFeature';
                                [RUN_OPTIONS]: IRunOptions;
                                [ENGINE]: typeof engine;
                                run(fn: () => unknown): unknown;
                                onDispose(fn: DisposeFunction): unknown;
                            }
                        >
                    ) => true
                );
            });
    });

    it('allow spawn of new environments and use remote services', () => {
        const main = new Environment('main', 'window', 'single');
        const processing = new Environment('processing', 'webworker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM.asDependency],
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
            dependencies: [echoFeature.asDependency],
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
});

describe.skip('Environments Type tests 1', () => {
    it('feature remote api should be available inside same feature setup', () => {
        const processing = new Environment('processing', 'webworker', 'single');

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM.asDependency],
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
