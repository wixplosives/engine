import { expect } from 'chai';
import { BaseHost, Communication, WsClientHost } from '@wixc3/engine-core';
import { FeatureEnvironmentMapping, NodeEnvManager } from '@wixc3/engine-runtime-node';
import { aEnv, bEnv } from '../test-kit/feature/envs.js';
import { EchoService } from '../test-kit/feature/types.js';

describe('NodeEnvManager with 2 node envs, remote api call', () => {
    let manager: NodeEnvManager;
    let communication: Communication;
    beforeEach(async () => {
        const featureEnvironmentsMapping: FeatureEnvironmentMapping = {
            featureToEnvironments: {
                'test-feature': [aEnv.env, bEnv.env],
            },
            availableEnvironments: {
                a: {
                    env: aEnv.env,
                    endpointType: 'single',
                    envType: 'node',
                    dependencies: [],
                },
                b: {
                    env: bEnv.env,
                    endpointType: 'single',
                    envType: 'node',
                    dependencies: [],
                },
            },
        };
        const meta = { url: import.meta.resolve('../test-kit/entrypoints/') };

        manager = new NodeEnvManager(meta, featureEnvironmentsMapping, {});
        const com = new Communication(new BaseHost(), 'test');
        const { port } = await manager.autoLaunch(new Map([['feature', 'test-feature']]));
        const host = new WsClientHost('http://localhost:' + port, {});
        com.registerEnv(aEnv.env, host);
        com.registerEnv(bEnv.env, host);
        com.registerMessageHandler(host);
        communication = com;
    });

    afterEach(async () => {
        await communication.dispose();
        await manager.dispose();
    });

    it('should reach env "a"', async () => {
        const api = communication.apiProxy<EchoService>({ id: aEnv.env }, { id: 'test-feature.echoAService' });

        expect(await api.echo()).to.equal('a');
    });
    it('should reach env "a", env "a" should reach env "b"', async () => {
        const api = communication.apiProxy<EchoService>({ id: aEnv.env }, { id: 'test-feature.echoAService' });

        expect(await api.echoChained()).to.equal('b');
    });
    it('should reach env "b", env "b" should reach env "a"', async () => {
        const api = communication.apiProxy<EchoService>({ id: bEnv.env }, { id: 'test-feature.echoBService' });

        expect(await api.echoChained()).to.equal('a');
    });
});
