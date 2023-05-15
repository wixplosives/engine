import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { COM, Environment, Feature, RuntimeEngine, Service, socketClientInitializer } from '@wixc3/engine-core';
import { createBrowserProvider } from '@wixc3/engine-test-kit';
import { launchEngineHttpServer, NodeEnvironmentsManager, IStaticFeatureDefinition } from '@wixc3/engine-runtime-node';
import { createDisposables } from '@wixc3/create-disposables';
import type io from 'socket.io';
(globalThis as any)['xxx'] = require('wtfnode');
import SocketServerNodeFeature, {
    serverEnv as socketServerEnv,
} from '@fixture/engine-multi-socket-node/dist/feature/x.feature';

import defaultArgsEchoFeature, {
    serverEnv as echoServerEnv,
} from '@fixture/engine-default-args-echo/dist/feature/echo.feature';

import ServerNodeFeature, { serverEnv } from '@fixture/engine-multi-node/dist/feature/x.feature';

chai.use(chaiAsPromised);

const runFeatureOptions = { featureName: 'engine-node/x' };

const env = new Environment('dev', 'node', 'single');
const comEntry: IStaticFeatureDefinition = {
    filePath: require.resolve('@wixc3/engine-core/dist/communication.feature'),
    packageName: '@wixc3/engine-core',
    scopedName: 'engine-core/communication',
};

const server2Env = new Environment('server-two', 'node', 'single');

const engineNodeEntry: IStaticFeatureDefinition = {
    dependencies: [comEntry.scopedName],
    envFilePaths: {
        server: require.resolve('@fixture/engine-node/dist/feature/x.server.env'),
    },
    exportedEnvs: [
        {
            name: 'server',
            type: 'node',
            env: serverEnv,
        },
    ],
    filePath: require.resolve('@fixture/engine-node/dist/feature/x.feature'),
    packageName: '@fixture/engine-node',
    scopedName: 'engine-node/x',
};

const engineMultiNodeSocketCommunication: IStaticFeatureDefinition = {
    dependencies: [comEntry.scopedName],
    filePath: require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.feature'),
    scopedName: 'engine-multi-socket-node/x',
    packageName: '@fixture/engine-multi-socket-node',
    envFilePaths: {
        server: require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.server.env'),
        'server-two': require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.server-two.env'),
    },
    exportedEnvs: [
        { name: 'server', type: 'node', env: serverEnv },
        { name: 'server-two', type: 'node', env: server2Env },
    ],
};

const engineMultiNodeIPCCommunication: IStaticFeatureDefinition = {
    dependencies: [comEntry.scopedName],
    filePath: require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.feature'),
    scopedName: 'engine-multi-socket-node/x',
    packageName: '@fixture/engine-multi-socket-node',
    envFilePaths: {
        server: require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.server.env'),
        'server-two': require.resolve('@fixture/engine-multi-socket-node/dist/feature/x.server-two.env'),
    },
    exportedEnvs: [
        { name: 'server', type: 'node', env: serverEnv },
        { name: 'server-two', type: 'node', env: server2Env },
    ],
};
describe('Node environments manager', function () {
    this.timeout(10_000);
    const disposables = createDisposables();
    const browserProvider = createBrowserProvider();
    let socketServer: io.Server;
    let port: number;

    beforeEach(async () => {
        const server = await launchEngineHttpServer();
        ({ socketServer, port } = server);
        disposables.add(server.close);
    });

    after(() => browserProvider.dispose());

    afterEach(disposables.dispose);

    it('launches a new node environment', async () => {
        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features: new Map<string, IStaticFeatureDefinition>(
                    Object.entries({
                        [engineNodeEntry.scopedName]: engineNodeEntry,
                        [comEntry.scopedName]: comEntry,
                    })
                ),
                port,
            },
            process.cwd()
        );

        disposables.add(() => nodeEnvironmentManager.closeAll());
        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);

        const allOpenEnvironments = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
        expect(allOpenEnvironments).to.be.not.an('undefined');
        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments[0]).to.contain(runFeatureOptions.featureName);
    });

    it('lists only open environments', async () => {
        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features: new Map<string, IStaticFeatureDefinition>(
                    Object.entries({
                        [engineNodeEntry.scopedName]: engineNodeEntry,
                        [comEntry.scopedName]: comEntry,
                    })
                ),
                port,
            },
            process.cwd()
        );

        disposables.add(() => nodeEnvironmentManager.closeAll());

        const allOpenEnvironments = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();

        expect(allOpenEnvironments).to.be.an('Array');
        expect(allOpenEnvironments.length).to.equal(0);

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);

        expect(nodeEnvironmentManager.getFeaturesWithRunningEnvironments()[0]).to.contain(
            runFeatureOptions.featureName
        );
    });

    it('fails to launch if wrong config name or feature name are provided', async () => {
        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features: new Map<string, IStaticFeatureDefinition>(
                    Object.entries({
                        [engineNodeEntry.scopedName]: engineNodeEntry,
                        [comEntry.scopedName]: comEntry,
                    })
                ),
                port,
            },
            process.cwd()
        );

        disposables.add(() => nodeEnvironmentManager.closeAll());

        await expect(
            nodeEnvironmentManager.runServerEnvironments({ featureName: 'test' })
        ).to.eventually.be.rejectedWith(
            'cannot find feature test. available features: engine-core/communication, engine-node/x'
        );
    });

    it('closes open environments', async () => {
        const nodeEnvironmentManager = new NodeEnvironmentsManager(
            socketServer,
            {
                features: new Map<string, IStaticFeatureDefinition>(
                    Object.entries({
                        [engineNodeEntry.scopedName]: engineNodeEntry,
                        [comEntry.scopedName]: comEntry,
                    })
                ),
                port,
            },
            process.cwd()
        );

        disposables.add(() => nodeEnvironmentManager.closeAll());

        await nodeEnvironmentManager.runServerEnvironments(runFeatureOptions);
        await expect(nodeEnvironmentManager.closeEnvironment({ featureName: 'test' })).to.eventually.be.rejectedWith(
            'there are no node environments running for test'
        );
    });

    describe('Node environment manager socket communication', () => {
        class ProxyFeature extends Feature<'test'> {
            id = 'test' as const;
            api = {
                echoService: Service.withType<{
                    echo: () => Promise<string>;
                }>().defineEntity(env),
            };
            dependencies = [SocketServerNodeFeature, COM];
        }

        ProxyFeature.setup(env, ({ run, onDispose }, { XTestFeature: { echoService }, COM: { communication } }) => {
            run(async () => {
                const { dispose } = await socketClientInitializer({ communication, env: socketServerEnv });
                onDispose(dispose);
            });
            return {
                echoService: {
                    echo: () => {
                        return echoService.echo();
                    },
                },
            };
        });

        it('allows socket communication between node environments', async () => {
            const nodeEnvironmentManager = new NodeEnvironmentsManager(
                socketServer,
                {
                    features: new Map<string, IStaticFeatureDefinition>(
                        Object.entries({
                            [engineMultiNodeSocketCommunication.scopedName]: engineMultiNodeSocketCommunication,
                            [comEntry.scopedName]: comEntry,
                        })
                    ),
                    port,
                },
                process.cwd()
            );

            disposables.add(() => nodeEnvironmentManager.closeAll());

            await nodeEnvironmentManager.runServerEnvironments({
                featureName: engineMultiNodeSocketCommunication.scopedName,
            });

            const engine = new RuntimeEngine(env, [
                COM.use({
                    config: {
                        topology: nodeEnvironmentManager.getTopology('engine-multi-socket-node/x'),
                    },
                }),
            ]);

            disposables.add(engine.shutdown);
            await engine.run(ProxyFeature);
            const res = await engine.get(ProxyFeature).api.echoService.echo();
            expect(res).to.eq('hello gaga');
        });

        it('remote API calls should work with undefined arguments', async () => {
            const engineMultiEnvCommunication: IStaticFeatureDefinition = {
                dependencies: [comEntry.scopedName],
                filePath: require.resolve('@fixture/engine-default-args-echo/dist/feature/echo.feature'),
                scopedName: 'engine-default-args-echo',
                packageName: '@fixture/engine-default-args-echo',
                envFilePaths: {
                    server: require.resolve('@fixture/engine-default-args-echo/dist/feature/echo.server.env'),
                },
                exportedEnvs: [{ name: 'server', type: 'node', env: serverEnv }],
            };

            const nodeEnvironmentManager = new NodeEnvironmentsManager(
                socketServer,
                {
                    features: new Map<string, IStaticFeatureDefinition>(
                        Object.entries({
                            [engineMultiEnvCommunication.scopedName]: engineMultiEnvCommunication,
                            [comEntry.scopedName]: comEntry,
                        })
                    ),
                    port,
                },
                process.cwd()
            );

            disposables.add(() => nodeEnvironmentManager.closeAll());

            await nodeEnvironmentManager.runServerEnvironments({
                featureName: engineMultiEnvCommunication.scopedName,
            });

            class ProxyFeatureTest extends Feature<'proxy'> {
                id = 'proxy' as const;
                api = {
                    echoService: Service.withType<{ echo: (s?: string) => Promise<string> }>().defineEntity(env),
                };
                dependencies = [defaultArgsEchoFeature, COM];
            }

            ProxyFeatureTest.setup(
                env,
                ({ run, onDispose }, { defaultArgsEcho: { echoService }, COM: { communication } }) => {
                    run(async () => {
                        const { dispose } = await socketClientInitializer({ communication, env: echoServerEnv });
                        onDispose(dispose);
                    });

                    return {
                        echoService: {
                            echo: (s?: string) => {
                                return echoService.echo(s);
                            },
                        },
                    };
                }
            );

            const engine = new RuntimeEngine(env, [
                COM.use({
                    config: {
                        topology: nodeEnvironmentManager.getTopology('engine-default-args-echo'),
                    },
                }),
            ]);
            disposables.add(engine.shutdown);

            await engine.run(ProxyFeatureTest);

            expect(await engine.get(ProxyFeatureTest).api.echoService.echo(undefined)).to.equal('dude, it works!');
        });

        it('allows socket communication between node environments when running in forked mode', async () => {
            const nodeEnvironmentManager = new NodeEnvironmentsManager(
                socketServer,
                {
                    features: new Map<string, IStaticFeatureDefinition>(
                        Object.entries({
                            [engineMultiNodeSocketCommunication.scopedName]: engineMultiNodeSocketCommunication,
                            [comEntry.scopedName]: comEntry,
                        })
                    ),
                    port,
                },
                process.cwd()
            );

            disposables.add(() => nodeEnvironmentManager.closeAll());

            await nodeEnvironmentManager.runServerEnvironments({
                featureName: engineMultiNodeSocketCommunication.scopedName,
                mode: 'forked',
            });

            const engine = new RuntimeEngine(env, [
                COM.use({
                    config: {
                        topology: nodeEnvironmentManager.getTopology(engineMultiNodeSocketCommunication.scopedName),
                    },
                }),
            ]);
            disposables.add(engine.shutdown);

            await engine.run(ProxyFeature);

            expect(await engine.get(ProxyFeature).api.echoService.echo()).to.eq('hello gaga');
        });
    });
    describe('Node environment manager ipc communication', () => {
        class TestFeature extends Feature<'test'> {
            id = 'test' as const;
            api = {
                echoService: Service.withType<{
                    echo: () => Promise<string>;
                }>().defineEntity(env),
            };
            dependencies = [ServerNodeFeature, COM];
        }

        TestFeature.setup(env, ({ run, onDispose }, { XTestFeature: { echoService }, COM: { communication } }) => {
            run(async () => {
                const { dispose } = await socketClientInitializer({ communication, env: serverEnv });
                onDispose(dispose);
            });

            return {
                echoService: {
                    echo: () => {
                        return echoService.echo();
                    },
                },
            };
        });

        it('allows local communication between node environments', async () => {
            const nodeEnvironmentManager = new NodeEnvironmentsManager(
                socketServer,
                {
                    features: new Map<string, IStaticFeatureDefinition>(
                        Object.entries({
                            [engineMultiNodeIPCCommunication.scopedName]: engineMultiNodeIPCCommunication,
                            [comEntry.scopedName]: comEntry,
                        })
                    ),
                    port,
                },
                process.cwd()
            );

            disposables.add(() => nodeEnvironmentManager.closeAll());

            await nodeEnvironmentManager.runServerEnvironments({
                featureName: engineMultiNodeIPCCommunication.scopedName,
            });

            const engine = new RuntimeEngine(env, [
                COM.use({
                    config: {
                        topology: nodeEnvironmentManager.getTopology(engineMultiNodeIPCCommunication.scopedName),
                    },
                }),
            ]);
            disposables.add(engine.shutdown);

            await engine.run(TestFeature);

            expect(await engine.get(TestFeature).api.echoService.echo()).to.eq('hello gaga');
        });

        it('allows local communication between node environments when running in forked mode', async () => {
            const nodeEnvironmentManager = new NodeEnvironmentsManager(
                socketServer,
                {
                    features: new Map<string, IStaticFeatureDefinition>(
                        Object.entries({
                            [engineMultiNodeIPCCommunication.scopedName]: engineMultiNodeIPCCommunication,
                            [comEntry.scopedName]: comEntry,
                        })
                    ),
                    port,
                },
                process.cwd()
            );

            disposables.add(() => nodeEnvironmentManager.closeAll());

            await nodeEnvironmentManager.runServerEnvironments({
                featureName: engineMultiNodeIPCCommunication.scopedName,
                mode: 'forked',
            });

            const engine = new RuntimeEngine(env, [
                COM.use({
                    config: {
                        topology: nodeEnvironmentManager.getTopology(engineMultiNodeIPCCommunication.scopedName),
                    },
                }),
            ]);

            disposables.add(engine.shutdown);

            await engine.run(TestFeature);

            expect(await engine.get(TestFeature).api.echoService.echo()).to.eq('hello gaga');
        });
    });
});
