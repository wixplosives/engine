import chai, { expect } from 'chai';
import { BaseHost } from '../../src/com/base-host';
import { Communication } from '../../src/com/communication';
import { SERVICE_CONFIG, multiTenantMethod } from '@wixc3/engine-core';
import sinonChai from 'sinon-chai';
import { stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

chai.use(sinonChai);
chai.use(chaiAsPromised);

class EchoService {
    echo(s: string) {
        return s;
    }
}

describe('Communication', () => {
    it('single communication', async () => {
        const host = new BaseHost();

        const main = new Communication(host, 'main');

        main.registerAPI(
            { id: 'echoService' },
            {
                echo(s: string) {
                    return s;
                }
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
                }
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
                echo: multiTenantMethod(this.echo)
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

    it.only('doesnt send callback message on a method that was defined not to send one', async () => {
        const host = new BaseHost();
        const main = new Communication(host, 'main', undefined, undefined, undefined, {
            warnOnSlow: true
        });

        const host2 = host.open();
        const child = new Communication(host2, 'child', undefined, undefined, undefined, {
            warnOnSlow: true
        });

        const handleMessageStub = stub(main, 'handleMessage');
        const childCallMethodStub = stub(child, 'callMethod');

        main.registerEnv('child', host2);

        child.registerAPI({ id: 'echoService' }, new EchoService());
        const proxy = main.apiProxy<EchoService>(
            Promise.resolve({ id: 'child' }),
            { id: 'echoService' },
            {
                echo: {
                    emitOnly: true
                }
            }
        );
        await proxy.echo('Yo!');

        expect(childCallMethodStub).to.have.not.been.called;
        expect(handleMessageStub).to.have.not.been.called;
    });
});
