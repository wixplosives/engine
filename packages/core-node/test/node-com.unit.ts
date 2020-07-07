import type { Socket } from 'net';
import { safeListeningHttpServer } from 'create-listening-server';
import io from 'socket.io';

import { expect } from 'chai';
import sinon from 'sinon';
import { waitFor } from 'promise-assist';

import { Communication, WsClientHost, socketServerInitializer, BaseHost } from '@wixc3/engine-core';
import { WsHost } from '@wixc3/engine-core-node';
import { createDisposables } from '@wixc3/engine-core';
import { fork } from 'child_process';
import { join } from 'path';
import { IPCHost } from '../src/ipc-host';

interface ICommunicationTestApi {
    sayHello: () => string;
    sayHelloWithDataAndParams: (name: string) => string;
}

describe('Socket communication', () => {
    let clientHost: WsClientHost;
    let serverHost: WsHost;
    let socketServer: io.Server;
    let port: number;

    const disposables = createDisposables();

    beforeEach(async () => {
        const getSocketAfterConnected = () =>
            new Promise<io.Socket>((resolve) => {
                const onConnection = (socket: io.Socket): void => {
                    disposables.add(() => {
                        socket.disconnect(true);
                    });
                    resolve(socket);
                };
                socketServer.on('connection', onConnection);
            });

        const { httpServer: server, port: servingPort } = await safeListeningHttpServer(3050);
        port = servingPort;
        socketServer = io(server);
        const connections = new Set<Socket>();
        disposables.add(() => new Promise((res) => socketServer.close(res)));
        const onConnection = (connection: Socket): void => {
            connections.add(connection);
            disposables.add(() => {
                connections.delete(connection);
            });
        };
        server.on('connection', onConnection);
        disposables.add(() => {
            for (const connection of connections) {
                connection.destroy();
            }
        });

        clientHost = new WsClientHost(`http://localhost:${port}`);
        serverHost = new WsHost(await getSocketAfterConnected());
        await clientHost.connected;
    });

    afterEach(disposables.dispose);

    it('Should activate a function from the client communication on the server communication and receive response', async () => {
        const COMMUNICATION_ID = 'node-com';
        const clientCom = new Communication(clientHost, 'client-host', {
            'server-host': `http://localhost:${port}`,
        });

        const serverCom = new Communication(serverHost, 'server-host');

        serverCom.registerAPI<ICommunicationTestApi>(
            { id: COMMUNICATION_ID },
            {
                sayHello: () => 'hello',
                sayHelloWithDataAndParams: (name: string) => `hello ${name}`,
            }
        );

        const methods = clientCom.apiProxy<ICommunicationTestApi>({ id: 'server-host' }, { id: COMMUNICATION_ID });
        expect(await methods.sayHello()).to.eq('hello');
    });

    it('Should activate a function with params from the client communication on the server communication and receive response', async () => {
        const COMMUNICATION_ID = 'node-com';
        const clientCom = new Communication(clientHost, 'client-host', {
            'server-host': `http://localhost:${port}`,
        });

        const serverCom = new Communication(serverHost, 'server-host');

        serverCom.registerAPI<ICommunicationTestApi>(
            { id: COMMUNICATION_ID },
            {
                sayHello: () => 'hello',
                sayHelloWithDataAndParams: (name: string) => `hello ${name}`,
            }
        );

        const methods = clientCom.apiProxy<ICommunicationTestApi>({ id: 'server-host' }, { id: COMMUNICATION_ID });
        expect(await methods.sayHelloWithDataAndParams('test')).to.eq('hello test');
    });

    it('One client should get messages from 2 server communications', async () => {
        const COMMUNICATION_ID = 'node-com';
        const clientCom = new Communication(clientHost, 'client-host', {
            'server-host': `http://localhost:${port}`,
            'second-server-host': `http://localhost:${port}`,
        });

        const serverCom = new Communication(serverHost, 'server-host');
        const secondServerCom = new Communication(serverHost, 'second-server-host');

        serverCom.registerAPI<ICommunicationTestApi>(
            { id: COMMUNICATION_ID },
            {
                sayHello: () => 'hello',
                sayHelloWithDataAndParams: (name: string) => `hello ${name}`,
            }
        );

        secondServerCom.registerAPI<ICommunicationTestApi>(
            { id: COMMUNICATION_ID },
            {
                sayHello: () => 'bye',
                sayHelloWithDataAndParams: (name: string) => `bye ${name}`,
            }
        );

        const Server1Methods = clientCom.apiProxy<ICommunicationTestApi>(
            { id: 'server-host' },
            { id: COMMUNICATION_ID }
        );
        const Server2Methods = clientCom.apiProxy<ICommunicationTestApi>(
            { id: 'second-server-host' },
            { id: COMMUNICATION_ID }
        );

        expect(await Server1Methods.sayHelloWithDataAndParams('test')).to.eq('hello test');
        expect(await Server2Methods.sayHelloWithDataAndParams('test')).to.eq('bye test');
    });

    it('Two clients should get messages from 1 server communication', async () => {
        const COMMUNICATION_ID = 'node-com';
        const clientCom = new Communication(clientHost, 'client-host', {
            'server-host': `http://localhost:${port}`,
        });

        const clientCom2 = new Communication(clientHost, 'client2-host', {
            'server-host': `http://localhost:${port}`,
        });

        const serverCom = new Communication(serverHost, 'server-host');

        serverCom.registerAPI<ICommunicationTestApi>(
            { id: COMMUNICATION_ID },
            {
                sayHello: () => 'hello',
                sayHelloWithDataAndParams: (name: string) => `hello ${name}`,
            }
        );

        const Server1Methods = clientCom.apiProxy<ICommunicationTestApi>(
            { id: 'server-host' },
            { id: COMMUNICATION_ID }
        );
        const Server2Methods = clientCom2.apiProxy<ICommunicationTestApi>(
            { id: 'server-host' },
            { id: COMMUNICATION_ID }
        );

        expect(await Server1Methods.sayHelloWithDataAndParams('test')).to.eq('hello test');
        expect(await Server2Methods.sayHelloWithDataAndParams('test')).to.eq('hello test');
    });

    it('notifies if environment is disconnected', async () => {
        const spy = sinon.spy();
        const clientCom = new Communication(clientHost, 'client-host', {
            'server-host': `http://localhost:${port}`,
        });
        const { onDisconnect } = await clientCom.startEnvironment(
            { env: 'server-host', endpointType: 'single', envType: 'node' },
            socketServerInitializer()
        );

        expect(onDisconnect).to.not.eq(undefined);

        onDisconnect(spy);
        socketServer.close();
        await waitFor(
            () => {
                expect(spy.callCount).to.be.eq(1);
            },
            {
                timeout: 2_000,
            }
        );
    });
});

describe('IPC communication', () => {
    const disposables = createDisposables();

    afterEach(disposables.dispose);
    it('communication with forked process', async () => {
        const mainHost = new BaseHost();
        const communication = new Communication(mainHost, 'main');
        const forked = fork(join(__dirname, 'process-entry.ts'), [], {
            execArgv: '-r @ts-tools/node/r -r tsconfig-paths/register'.split(' '),
            cwd: process.cwd(),
        });
        disposables.add(() => forked.kill());
        const host = new IPCHost(forked);
        communication.registerEnv('process', host);
        communication.registerMessageHandler(host);
        const proxy = communication.apiProxy<{ echo(): string }>(
            {
                id: 'process',
            },
            { id: 'myApi' }
        );

        expect(await proxy.echo()).to.eq('yo');
    });
});
