import { expect } from 'chai';
import { BaseHost, Communication, WsClientHost } from '@wixc3/engine-core';
import { NodeEnvsFeatureMapping, NodeEnvManager } from '@wixc3/engine-runtime-node';
import { aEnv, bEnv } from '../test-kit/feature/envs.js';
import { EchoService } from '../test-kit/feature/types.js';

describe('NodeEnvManager with 2 node envs, remote api call', () => {
    const testCommunicationId = 'test';
    let manager: NodeEnvManager;
    let communication: Communication;
    let nodeEnvsPort: number;
    beforeEach(async () => {
        const featureEnvironmentsMapping: NodeEnvsFeatureMapping = {
            featureToEnvironments: {
                'test-feature': [aEnv.env, bEnv.env],
            },
            availableEnvironments: {
                a: {
                    env: aEnv.env,
                    endpointType: 'single',
                    envType: 'node',
                },
                b: {
                    env: bEnv.env,
                    endpointType: 'single',
                    envType: 'node',
                },
            },
        };
        const meta = { url: import.meta.resolve('../test-kit/entrypoints/') };

        manager = new NodeEnvManager(meta, featureEnvironmentsMapping);
        const { port } = await manager.autoLaunch(new Map([['feature', 'test-feature']]));
        nodeEnvsPort = port;
        const host = new WsClientHost('http://localhost:' + port, {});
        const com = new Communication(new BaseHost(), testCommunicationId);
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

    it('should handle two communication with the same', async () => {
        // setup new com instance with the same id
        const communication2 = new Communication(new BaseHost(), testCommunicationId);
        const host = new WsClientHost('http://localhost:' + nodeEnvsPort, {});

        communication2.registerEnv(aEnv.env, host);
        communication2.registerEnv(bEnv.env, host);
        communication2.registerMessageHandler(host);

        const api1 = communication.apiProxy<EchoService>({ id: bEnv.env }, { id: 'test-feature.echoBService' });
        const api2 = communication2.apiProxy<EchoService>({ id: aEnv.env }, { id: 'test-feature.echoAService' });
        const result1 = api1.echo();
        const result2 = api2.echo();

        expect(await result1).to.equal('b');
        expect(await result2).to.equal('a');
    });
});
