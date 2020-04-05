import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { stub, spy } from 'sinon';

import {
    SERVICE_CONFIG,
    multiTenantMethod,
    BaseHost,
    Communication,
    EventEmitterHost,
    createDisposables,
} from '../../src';

import { EventEmitter } from 'events';

chai.use(sinonChai);
chai.use(chaiAsPromised);

class EchoService {
    echo(s: string) {
        return s;
    }
}

describe('Communication', () => {
    const disposables = createDisposables();

    afterEach(disposables.dispose);

    it('single communication', async () => {
        const host = new BaseHost();

        const main = new Communication(host, 'main');

        main.registerAPI(
            { id: 'echoService' },
            {
                echo(s: string) {
                    return s;
                },
            }
        );

        const proxy = main.apiProxy<EchoService>(Promise.resolve({ id: 'main' }), { id: 'echoService' });

        const res = await proxy.echo('Yoo!');

        expect(res).to.be.equal('Yoo!');
    });
    it('multi communication', async () => {
        const host = new BaseHost();
        const main = new Communication(host, 'main');

        const host2 = host.open();
        const main2 = new Communication(host2, 'main2');

        main.registerEnv('main2', host2);

        main2.registerAPI(
            { id: 'echoService' },
            {
                echo(s: string) {
                    return s;
                },
            }
        );

        const proxy = main.apiProxy<EchoService>(Promise.resolve({ id: 'main2' }), { id: 'echoService' });

        const res = await proxy.echo('Yoo!');

        expect(res).to.be.equal('Yoo!');
    });

    it('multitenant multi communication', async () => {
        // creating 3 environments - main as a parent, and 2 child environments
        const host = new BaseHost();
        const main = new Communication(host, 'main');

        const host2 = host.open();
        const child = new Communication(host2, 'child');

        const host3 = host.open();
        const child2 = new Communication(host3, 'child2');

        // registering them to main
        main.registerEnv('child', host2);
        main.registerEnv('child2', host3);

        // a class with a multitenant function
        class MultiEcho {
            [SERVICE_CONFIG] = {
                echo: multiTenantMethod(this.echo),
            };
            echo(id: string, s: string) {
                return `${id} echo ${s}`;
            }
        }

        // registering the MultiEcho service on child2 com
        child2.registerAPI({ id: 'echoService' }, new MultiEcho());

        // creating a proxy between main and child2 and registering it
        const child2Proxy = main.apiProxy<MultiEcho>(Promise.resolve({ id: 'child2' }), { id: 'echoService' });
        child.registerAPI({ id: 'echoService' }, child2Proxy);

        // creating the proxy between child and child2 using the proxy between main and child2
        const childProxy = child.apiProxy<MultiEcho>(Promise.resolve({ id: 'child2' }), { id: 'echoService' });

        const res = await childProxy.echo('Yoo!');

        expect(res).to.be.equal('child echo Yoo!');
    });

    it('doesnt send callback message on a method that was defined not to send one', async () => {
        const host = new BaseHost();
        const main = new Communication(host, 'main', undefined, undefined, undefined, {
            warnOnSlow: true,
        });

        const host2 = host.open();
        const child = new Communication(host2, 'child', undefined, undefined, undefined, {
            warnOnSlow: true,
        });

        // handleMessage is called when message is recieved from remote
        const handleMessageStub = stub(main, 'handleMessage');

        // callMethod is being called when sending call/listen request to other origin
        const childCallMethodStub = stub(child, 'callMethod');

        main.registerEnv('child', host2);

        child.registerAPI({ id: 'echoService' }, new EchoService());
        const proxy = main.apiProxy<EchoService>(
            Promise.resolve({ id: 'child' }),
            { id: 'echoService' },
            {
                echo: {
                    emitOnly: true,
                },
            }
        );
        await proxy.echo('Yo!');

        // we want to check a callback message was not send
        expect(childCallMethodStub).to.have.not.been.called;

        // we need to check that no message was received
        expect(handleMessageStub).to.have.not.been.called;
    });

    it('forwards listen calls', async () => {
        const middlemanHost = new BaseHost();
        const aHost = new BaseHost();
        const bHost = new BaseHost();

        const mainCom = disposables.add(new Communication(middlemanHost, 'middle'));
        const bCom = disposables.add(new Communication(bHost, 'bEnv'));
        const aCom = disposables.add(new Communication(aHost, 'aEnv'));

        aCom.registerEnv('bEnv', middlemanHost);
        aCom.registerEnv('middle', middlemanHost);

        mainCom.registerEnv('aEnv', aHost);
        mainCom.registerEnv('bEnv', bHost);

        bCom.registerEnv('middle', middlemanHost);
        bCom.registerEnv('aEnv', middlemanHost);

        const mockApi = getMockApi();
        bCom.registerAPI({ id: 'myApi' }, mockApi);

        const mockApiProxyFromAEnv = aCom.apiProxy<typeof mockApi>(
            { id: 'bEnv' },
            { id: 'myApi' },
            {
                listen: {
                    listener: true,
                },
            }
        );

        const spyFn = spy();

        await mockApiProxyFromAEnv.listen(spyFn);

        const spyFn2 = spy();
        await mockApiProxyFromAEnv.listen(spyFn2);
        mockApi.invoke();

        expect(spyFn).to.have.callCount(1);
        expect(spyFn2).to.have.callCount(1);
        expect(spyFn.calledWith(1)).to.eq(true);
    });

    it('forwards listen calls only if listener was configured', async () => {
        const middlemanHost = new BaseHost();
        const aHost = new BaseHost();
        const bHost = new BaseHost();

        const mainCom = disposables.add(new Communication(middlemanHost, 'middle'));
        const bCom = disposables.add(new Communication(bHost, 'bEnv'));
        const aCom = disposables.add(new Communication(aHost, 'aEnv'));

        aCom.registerEnv('bEnv', middlemanHost);
        aCom.registerEnv('middle', middlemanHost);

        mainCom.registerEnv('aEnv', aHost);
        mainCom.registerEnv('bEnv', bHost);

        bCom.registerEnv('middle', middlemanHost);
        bCom.registerEnv('aEnv', middlemanHost);

        const mockApi = getMockApi();
        bCom.registerAPI({ id: 'myApi' }, mockApi);
        const mockApiProxyFromAEnv = aCom.apiProxy<typeof mockApi>({ id: 'bEnv' }, { id: 'myApi' });

        const spyFn = spy();
        await expect(mockApiProxyFromAEnv.listen(spyFn)).to.be.eventually.rejectedWith(
            'cannot add listenr to unconfigured method myApi listen'
        );
    });

    it('forwards unlisten calls', async () => {
        const middlemanHost = new BaseHost();
        const aHost = new BaseHost();
        const bHost = new BaseHost();

        const mainCom = disposables.add(new Communication(middlemanHost, 'middle'));
        const bCom = disposables.add(new Communication(bHost, 'bEnv'));
        const aCom = disposables.add(new Communication(aHost, 'aEnv'));

        aCom.registerEnv('bEnv', middlemanHost);
        aCom.registerEnv('middle', middlemanHost);

        mainCom.registerEnv('aEnv', aHost);
        mainCom.registerEnv('bEnv', bHost);

        bCom.registerEnv('middle', middlemanHost);
        bCom.registerEnv('aEnv', middlemanHost);

        const mockApi = getMockApi();
        bCom.registerAPI({ id: 'myApi' }, mockApi);

        const mockApiProxyFromAEnv = aCom.apiProxy<typeof mockApi>(
            { id: 'bEnv' },
            { id: 'myApi' },
            {
                listen: {
                    listener: true,
                },
                unsubscribe: {
                    removeListener: 'listen',
                },
            }
        );

        const spyFn = spy();
        const spyFn2 = spy();
        await mockApiProxyFromAEnv.listen(spyFn);
        await mockApiProxyFromAEnv.listen(spyFn2);
        await mockApiProxyFromAEnv.unsubscribe(spyFn);

        mockApi.invoke();

        expect(spyFn).to.have.callCount(0);
        expect(spyFn2).to.have.callCount(1);
        expect(mockApi.getListenersCount()).to.eq(1);
        await mockApiProxyFromAEnv.unsubscribe(spyFn2);

        mockApi.invoke();
        expect(spyFn2).to.have.callCount(1);
        expect(mockApi.getListenersCount()).to.eq(0);
    });
});

describe('Event Emitter communication', () => {
    it('single communication', async () => {
        const eventEmitter = new EventEmitter();
        const host = new EventEmitterHost(eventEmitter);

        const main = new Communication(host, 'main');

        main.registerAPI(
            { id: 'echoService' },
            {
                echo(s: string) {
                    return s;
                },
            }
        );

        const proxy = main.apiProxy<EchoService>(Promise.resolve({ id: 'main' }), { id: 'echoService' });

        const res = await proxy.echo('Yoo!');

        expect(res).to.be.equal('Yoo!');
    });

    it('multi communication', async () => {
        const host = new BaseHost();
        const eventEmitter = new EventEmitter();
        const host2 = new EventEmitterHost(eventEmitter);

        const main = new Communication(host, 'main');
        const main2 = new Communication(host2, 'main2');

        main.registerEnv('main2', host2);
        main2.registerAPI(
            { id: 'echoService' },
            {
                echo(s: string) {
                    return s;
                },
            }
        );

        main2.registerEnv('main', host);
        const proxy = main.apiProxy<EchoService>(Promise.resolve({ id: 'main2' }), { id: 'echoService' });

        const res = await proxy.echo('Yoo!');

        expect(res).to.be.equal('Yoo!');
    });
});

function getMockApi() {
    const listeners = new Set<(number: number) => void>();
    const mockApi = {
        listen: function (cb: (number: number) => void) {
            listeners.add(cb);
        },
        invoke() {
            for (const listener of listeners) {
                listener(1);
            }
        },
        unsubscribe: function (cb: (number: number) => void) {
            listeners.delete(cb);
        },
        getListenersCount: function () {
            return listeners.size;
        },
    };
    return mockApi;
}
