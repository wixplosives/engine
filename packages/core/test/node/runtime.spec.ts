import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { spy } from 'sinon';
import sinonChai from 'sinon-chai';
import { EQUAL } from 'typescript-type-utils';
import {
    AllEnvironments,
    COM,
    Config,
    DisposeFunction,
    Environment,
    Feature,
    MapSlot,
    run as runEngine,
    Service,
    SingleEndPointAsyncEnvironment,
    SingleEndpointContextualEnvironment,
    Slot,
    Universal
} from '../../src';
import { type_check } from '../type-check';

chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Feature', () => {
    it('single feature entry', () => {
        const f = new Feature({
            id: 'test',
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test' })
            }
        });

        expect(runEngine(f).get(f).api.config.name).to.be.equal('test');
    });

    it('single feature entry with dependencies', () => {
        const f1 = new Feature({
            id: 'test1',
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test1' })
            }
        });

        const f2 = new Feature({
            id: 'test2',
            dependencies: [f1],
            api: {
                config: Config.withType<{ name: string }>().defineEntity({ name: 'test2' })
            }
        });
        const engine = runEngine([f1, f2]);

        expect(engine.get(f1).api.config.name).to.equal('test1');
        expect(engine.get(f2).api.config.name).to.equal('test2');
    });

    it('feature run stage', () => {
        const f0 = new Feature({ id: 'test', api: {} });
        const f1 = new Feature({ id: 'test', api: {}, dependencies: [f0] });
        const calls: string[] = [];

        f0.setup(AllEnvironments, ({ run }) => {
            run(() => {
                calls.push('f0 run');
            });
            return null;
        });

        f1.setup(AllEnvironments, ({ run }) => {
            run(() => {
                calls.push('f1 run');
            });
            return null;
        });

        runEngine(f1);

        expect(calls).to.eql(['f0 run', 'f1 run']);
    });

    it('feature setup/run stage should not happen twice', () => {
        const f0 = new Feature({ id: 'test', api: {} });
        const f1 = new Feature({ id: 'test', api: {}, dependencies: [f0] });
        const calls: string[] = [];

        f0.setup(AllEnvironments, ({ run }) => {
            calls.push('f0 setup');
            run(() => {
                calls.push('f0 run');
            });
            return null;
        });

        f1.setup(AllEnvironments, ({ run }) => {
            calls.push('f1 setup');
            run(() => {
                calls.push('f1 run');
            });
            return null;
        });

        runEngine([f0, f1, f0, f1]);

        expect(calls).to.eql(['f0 setup', 'f1 setup', 'f0 run', 'f1 run']);
    });

    it('feature should provide requirements (outputs) of each environment', () => {
        const MAIN1 = new Environment('main1');

        const f0 = new Feature({
            id: 'test',
            api: {
                service1: Service.withType<{ echo(x: string): string }>().defineEntity(Universal),
                service2: Service.withType<{ echo(x: string): string }>().defineEntity(MAIN1)
            }
        });

        f0.setup(Universal, () => {
            return {
                service1: {
                    echo(x: string) {
                        return x + '-main1';
                    }
                }
            };
        });

        f0.setup(MAIN1, () => {
            return {
                service2: {
                    echo(x: string) {
                        return x + '-main2';
                    }
                }
            };
        });
        const { service1, service2 } = runEngine([f0]).get(f0).api;
        expect(service1.echo('ECHO')).to.eql('ECHO-main1');
        expect(service2.echo('ECHO')).to.eql('ECHO-main2');
    });

    it('feature should throw if setup is called with same environment twice', () => {
        const f0 = new Feature({
            id: 'test',
            api: {
                service1: Service.withType<{ echo(x: string): string }>().defineEntity('main1'),
                service2: Service.withType<{ echo(x: string): string }>().defineEntity('main2')
            }
        });
        expect(() => {
            f0.setup('main1', () => {
                return {
                    service1: {
                        echo(x: string) {
                            return x + '-main1';
                        }
                    }
                };
            });

            f0.setup('main1', () => {
                return {
                    service1: {
                        echo(x: string) {
                            return x + '-main2';
                        }
                    }
                };
            });
        }).to.throw('Feature can only have single setup for each environment.');
    });

    describe('Feature Config', () => {
        it('support multiple top level partial configs', () => {
            const test = new Feature({
                id: 'test',
                api: {
                    config: Config.withType<{ a: string; b: string; c: number[] }>().defineEntity({
                        a: '',
                        b: '',
                        c: []
                    })
                }
            });

            const engine = runEngine(test, [
                test.use({
                    config: { a: 'a' }
                }),
                test.use({
                    config: { b: 'b', c: [1] }
                })
            ]);

            expect(engine.get(test).api.config).to.be.eql({
                a: 'a',
                b: 'b',
                c: [1]
            });
        });

        it('support config merger', () => {
            const test = new Feature({
                id: 'test',
                api: {
                    config: Config.withType<{ a: string; b: string; c: number[] }>().defineEntity(
                        { a: '', b: '', c: [] },
                        (a, b) => {
                            return {
                                a: a.a || b.a || '',
                                b: a.b || b.b || '',
                                c: a.c.concat(b.c || [])
                            };
                        }
                    )
                }
            });

            const engine = runEngine(test, [
                test.use({
                    config: { a: 'a', c: [1] }
                }),
                test.use({
                    config: { b: 'b', c: [2] }
                })
            ]);

            expect(engine.get(test).api.config).to.be.eql({
                a: 'a',
                b: 'b',
                c: [1, 2]
            });
        });
    });

    describe('Support Map Slots', () => {
        it('single feature that supports map slots', () => {
            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity('main'),
                    retrieveService: Service.withType<{ getValue(key: string): string | null }>().defineEntity('main')
                }
            }).setup('main', ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        }
                    }
                };
            });

            const f1 = new Feature({
                id: 'testSlotsSecondFeature',
                api: {},
                dependencies: [maps]
            }).setup('main', ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('1', 'test');
                mapSlot.register('2', 'test2');
                return null;
            });

            const engine = runEngine(f1);
            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal('test');
        });

        it('two features that adds to slots', () => {
            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity('main'),
                    retrieveService: Service.withType<{ getValue(key: string): string | null }>().defineEntity('main')
                }
            }).setup('main', ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        }
                    }
                };
            });

            const f1 = new Feature({
                id: 'testSlotsFirstFeature',
                api: {},
                dependencies: [maps]
            }).setup('main', ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('1', 'test');
                mapSlot.register('2', 'test2');
                return null;
            });

            const f2 = new Feature({
                id: 'testSlotsSecondFeature',
                api: {},
                dependencies: [maps]
            }).setup('main', ({}, { testSlotsFeature: { mapSlot } }) => {
                mapSlot.register('2', 'test2');
                return null;
            });

            const engine = runEngine([f1, f2]);
            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal('test');
            expect(engine.get(maps).api.retrieveService.getValue('2')).to.be.equal('test2');
        });

        it('try to get value from the slot, when the key is not in the map', () => {
            const maps = new Feature({
                id: 'testSlotsFeature',
                api: {
                    mapSlot: MapSlot.withType<string, string>().defineEntity('main'),
                    retrieveService: Service.withType<{ getValue(key: string): string | null }>().defineEntity('main')
                }
            }).setup('main', ({ mapSlot }) => {
                return {
                    retrieveService: {
                        getValue(key: string) {
                            return mapSlot.get(key);
                        }
                    }
                };
            });

            const f1 = new Feature({
                id: 'testSlotsFirstFeature',
                api: {},
                dependencies: [maps]
            }).setup('main', ({}, {}) => {
                return null;
            });

            const engine = runEngine(f1);

            expect(engine.get(maps).api.retrieveService.getValue('1')).to.be.equal(null);
        });
    });
});

describe('feature interaction', () => {
    it('should run engine with two features interacting', () => {
        const echoFeature = new Feature({
            id: 'echoFeature',
            api: {
                transformers: Slot.withType<(s: string) => string>().defineEntity('main'),
                echoService: Service.withType<{ echo(s: string): string }>().defineEntity('main')
            }
        }).setup('main', ({ transformers }) => {
            return {
                echoService: {
                    echo(s: string) {
                        return [...transformers].reduce((item, transformer) => {
                            return transformer(item);
                        }, s);
                    }
                }
            };
        });

        ////////////////////////////////////////////////////////

        const feature2 = new Feature({
            id: 'feature2',
            dependencies: [echoFeature],
            api: {
                config: Config.withType<{ prefix: string; suffix: string }>().defineEntity({ prefix: '', suffix: '' })
            }
        }).setup('main', ({ config }, { echoFeature: { transformers } }) => {
            transformers.register((s: string) => {
                return `${config.prefix}${s}${config.suffix}`;
            });
            return null;
        });

        const engine = runEngine(feature2, [
            feature2.use({
                config: { prefix: '!' }
            }),
            feature2.use({
                config: { suffix: '?' }
            })
        ]);

        expect(engine.get(echoFeature).api.echoService.echo('yoo')).to.be.equal('!yoo?');
    });
});

describe('Contextual environments', () => {
    it('Feature should define contextual environment, set up the environment context and use it in the environment setup', async () => {
        const workerEnv = new Environment('worker');
        const processing = new SingleEndpointContextualEnvironment('processing', [workerEnv]);

        interface IProcessingContext {
            name: string;
        }

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                echoService: Service.withType<{ echo(s: string): string }>().defineEntity(processing)
            },
            context: {
                processingContext: processing.withContext<IProcessingContext>(),
                processingContext2: processing.withContext<{ age: number }>()
            }
        });

        echoFeature.setupContext('processingContext', () => {
            return {
                name: 'test'
            };
        });

        echoFeature.setupContext('processingContext2', () => {
            return {
                age: 1
            };
        });

        echoFeature.setup(processing, ({}, {}, { processingContext: { name }, processingContext2: { age } }) => {
            return {
                echoService: {
                    echo(s: string) {
                        return `${s} ${name} ${age}`;
                    }
                }
            };
        });

        const engine = runEngine(echoFeature);

        expect(await engine.get(echoFeature).api.echoService.echo('hello')).to.eq('hello test 1');
    });
});

describe('feature disposal', () => {
    it('disposes a feature on engine dispose call', async () => {
        const mainEnv = new Environment('main');
        const disposableFeature = new Feature({
            id: 'test',
            api: {}
        });
        const dispose = spy(() => Promise.resolve());
        disposableFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(dispose);
            return null;
        });

        const engine = runEngine(disposableFeature);

        await engine.dispose(disposableFeature);

        expect(dispose).to.have.have.callCount(1);
    });

    it('allows feature to register to onDispose several times', async () => {
        const mainEnv = new Environment('main');
        const disposableFeature = new Feature({
            id: 'test',
            api: {}
        });
        const dispose = spy(() => Promise.resolve());

        disposableFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(dispose);
            onDispose(dispose);

            return null;
        });

        const engine = runEngine(disposableFeature);

        await engine.dispose(disposableFeature);

        expect(dispose).to.have.have.callCount(2);
    });

    it('throws an error if on of the onDispose functiones was rejected', async () => {
        const mainEnv = new Environment('main');
        const disposableFeature = new Feature({
            id: 'test',
            api: {}
        });
        const disposeFirst = spy(() => Promise.resolve());
        const disposeSecond = spy(() => Promise.reject('err'));

        disposableFeature.setup(mainEnv, ({ onDispose }, {}) => {
            onDispose(disposeFirst);
            onDispose(disposeSecond);

            return null;
        });

        const engine = runEngine(disposableFeature);

        await expect(engine.dispose(disposableFeature)).to.be.rejectedWith('err');

        expect(disposeFirst).to.have.have.callCount(1);
        expect(disposeSecond).to.have.have.callCount(1);
    });
});

describe.skip('Environments And Entity Visibility (ONLY TEST TYPES)', () => {
    it('should verify visibility of slots', () => {
        const main = new Environment('main');
        const processing = new SingleEndPointAsyncEnvironment('processing', 'worker', main);

        new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                slot: Slot.withType<{ name: string }>().defineEntity(main)
            }
        })
            .setup(main, ({ slot }) => {
                slot.register({ name: 'test' });
                return null;
            })
            .setup(processing, x => {
                type_check(
                    (
                        _noSlot: EQUAL<
                            typeof x,
                            {
                                id: 'echoFeature';
                                run(fn: () => unknown): unknown;
                                onDispose(fn: DisposeFunction): unknown;
                            }
                        >
                    ) => true
                );
                return null;
            });
    });

    it('allow spawn of new environments and use remote services', () => {
        const main = new Environment('main');
        const processing = new SingleEndPointAsyncEnvironment('processing', 'worker', main);

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                echoService: Service.withType<{ echo(s: string): string }>()
                    .defineEntity(processing)
                    .allowRemoteAccess()
            }
        });

        echoFeature.setup(processing, () => {
            return {
                echoService: {
                    echo(s: string) {
                        return s;
                    }
                }
            };
        });

        // echoFeature.setup(main, ({}, { COM }) => {
        //     let id1: EnvironmentInstanceToken | undefined
        //     return {
        //         processing: {
        //             async requestEnvironment() {
        //                 if (id1) {
        //                     return id1
        //                 }
        //                 return (id1 = await COM.spawn(processing))
        //             }
        //         }
        //     }
        // })
        const checks = [];
        const testFeature = new Feature({
            id: 'test',
            dependencies: [echoFeature],
            api: {}
        });

        testFeature.setup(processing, ({ run }, { echoFeature: { echoService } }) => {
            run(() => {
                checks.push(echoService.echo('echo1'));
            });
            return null;
        });

        testFeature.setup(main, ({ run }, { echoFeature: { echoService } }) => {
            run(() => {
                echoService.echo('echo2').then(val => {
                    checks.push(val);
                });
            });
            return null;
        });
    });
});

describe.skip('Environments Type tests 1', () => {
    it('feature remote api should be available inside same feature setup', () => {
        const main = new Environment('main');
        const processing = new SingleEndPointAsyncEnvironment('processing', 'worker', main);

        const echoFeature = new Feature({
            id: 'echoFeature',
            dependencies: [COM],
            api: {
                // processing,
                echoService: Service.withType<{ echo(s: string): string }>()
                    .defineEntity(processing)
                    .allowRemoteAccess()
            }
        });

        echoFeature.setup(processing, ({}, {}) => {
            return {
                echoService: {
                    echo(s: string) {
                        return s;
                    }
                }
            };
        });

        // echoFeature.setup(main, ({}, { COM }) => {
        //     let id1: EnvironmentInstanceToken | undefined

        //     return {
        //         processing: {
        //             async requestEnvironment() {
        //                 if (id1) {
        //                     return id1
        //                 }
        //                 return (id1 = await COM.spawn(processing))
        //             }
        //         }
        //     }
        // })
    });
});
