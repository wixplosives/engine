import { expect } from 'chai';
import { deferred, waitFor } from 'promise-assist';
import {
    createDisposables,
    Communication,
    Environment,
    declareComEmitter,
    iframeInitializer,
    deferredIframeInitializer,
    BaseHost,
} from '@wixc3/engine-core';
import {
    ITestServiceData,
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    testServiceId,
    HashParamsRetriever,
    hashParamsRetriever,
    testServiceError,
} from './test-api-service';

describe('Communication API', function () {
    this.timeout(10_000);

    const disposables = createDisposables();
    afterEach(disposables.dispose);

    const iframeStyle: Partial<CSSStyleDeclaration> = {
        width: '300px',
        height: '300px',
        bottom: '0px',
        right: '0px',
        position: 'fixed',
    };
    const createIframe = (): HTMLIFrameElement => {
        const iframe = document.createElement('iframe');
        disposables.add(() => iframe.remove());
        Object.assign(iframe.style, iframeStyle);
        document.body.appendChild(iframe);
        return iframe;
    };

    const comId = 'TEST_COM';
    const iframeEnv = new Environment('iframe', 'iframe', 'multi');

    it('should proxy remote service api', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('allows providing custom src', async () => {
        const com = disposables.add(new Communication(window, comId));

        const iframeElement = createIframe();

        const { initialize, id } = deferredIframeInitializer({
            communication: com,
            env: iframeEnv,
        });
        const testContent = 'hello world';
        const jsContent = `const p = document.createElement('p');
p.innerText = '${testContent}';
document.body.appendChild(p);
const id = '${id}';
window.parent.postMessage({ type: 'ready', from: id, to: '*', origin: id });`;
        const src = URL.createObjectURL(
            new Blob([jsContent], {
                type: 'application/javascript',
            })
        );
        await initialize({
            iframeElement,
            src,
        });
        expect(iframeElement.contentWindow?.document.body.textContent).to.eq(testContent);
    });

    it('should proxy exceptions thrown in remote service api', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = await iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const error = await api.failWithError().catch((e: unknown) => e);

        expect(error).to.be.instanceOf(Error);
        expect(error).to.deep.include(testServiceError);
    });

    it('should listen to remote api callbacks', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });
        const api = com.apiProxy<TestService>(env, { id: testServiceId }, declareComEmitter('listen', '', ''));
        const capturedCalls: ITestServiceData[] = [];
        await api.listen((data) => capturedCalls.push(data));

        await api.testApi(1, 2, 3);
        await api.testApi(3, 2, 1);

        expect(capturedCalls).to.eql([{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }]);
    });

    it('handles a multi tenant function in api services', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<MultiTenantTestService>(env, { id: multiTanentServiceId });

        const result = await api.multiTenantFunction('test');

        expect(result).to.eql({
            id: com.getEnvironmentId(),
            anotherArg: 'test',
        });
    });

    it('handles a single tenant function in api services that have multi tenant functions', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<MultiTenantTestService>(env, { id: multiTanentServiceId });

        const result = await api.singleTenantFunction('id', 'test');

        expect(result).to.eql({
            id: 'id',
            anotherArg: 'test',
        });
    });

    it('listen to multiple environment with the same api (iframe)', async () => {
        const com = disposables.add(new Communication(window, comId));

        const [env1, env2] = await Promise.all([
            iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() }),
            iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() }),
        ]);

        const api1 = com.apiProxy<TestService>(env1, { id: testServiceId }, { listen: { listener: true } });
        const api2 = com.apiProxy<TestService>(env2, { id: testServiceId }, { listen: { listener: true } });

        const capturedCallsApi1: ITestServiceData[] = [];
        const capturedCallsApi2: ITestServiceData[] = [];
        await api1.listen((data) => capturedCallsApi1.push(data));
        await api2.listen((data) => capturedCallsApi2.push(data));

        await api1.testApi(1, 2, 3);
        await api1.testApi(3, 2, 1);

        await api2.testApi(7, 8, 9);
        await api2.testApi(9, 8, 7);

        await waitFor(() => {
            expect(capturedCallsApi1, 'capturedCallsApi1').to.eql([{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }]);
            expect(capturedCallsApi2, 'capturedCallsApi2').to.eql([{ echo: [7, 8, 9] }, { echo: [9, 8, 7] }]);
        });
    });

    it('resolves spawn only when com is ready', async () => {
        const com = disposables.add(new Communication(window, comId));
        const delayedIframeEnv = new Environment('delayed-iframe', 'iframe', 'multi');

        const env = iframeInitializer({
            communication: com,
            env: delayedIframeEnv,
            iframeElement: createIframe(),
            managed: false,
        });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('allows initiating iframe environment with parameters', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = disposables.add(new Communication(window, comId));

        const env = await iframeInitializer({
            communication: com,
            env: iframeEnv,
            iframeElement: createIframe(),
            hashParams: '#test',
            managed: true,
        });

        const api = com.apiProxy<HashParamsRetriever>(env, { id: hashParamsRetriever });

        await waitFor(async () => {
            const deserializedHash = decodeURIComponent(await api.getHashParams());
            expect(deserializedHash).to.eq(`#test`);
        });
    });

    it('should allow to load iframe after receiving its token id', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = disposables.add(new Communication(window, comId));

        const env = deferredIframeInitializer({ communication: com, env: iframeEnv });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = api.testApi(1, 2, 3);
        expect(com.getEnvironmentHost(env.id)).to.eq(undefined);

        await env.initialize({
            iframeElement: createIframe(),
        });

        expect(await res).to.eql({ echo: [1, 2, 3] });
    });

    it('should allow subscribing to events in non-initialized iframe', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = disposables.add(new Communication(window, comId));

        const env = deferredIframeInitializer({ communication: com, env: iframeEnv });

        const api = com.apiProxy<TestService>(
            env,
            { id: testServiceId },
            {
                listen: {
                    listener: true,
                },
            }
        );
        const { promise, resolve } = deferred<ITestServiceData>();

        void api.listen(resolve);
        void api.testApi(1, 2, 3);

        // this should happen later then the api calls in the event loop
        setTimeout(() => {
            env.initialize({
                iframeElement: createIframe(),
            }).catch(console.error);
        }, 0);

        expect(await promise).to.eql({ echo: [1, 2, 3] });
    });

    it('supports answering forwarded message from a forwarded message', async () => {
        /**
         * The flow of the test is as follows:
         * setup communication in a way where:
         *   1 talks to 2
         *   3 talks to 4
         *   1 talks to 3
         *
         * and then initiate a message from 2 to 4, which will be farwarded twice - when it will arrive to 1 and then to 3, and will be forwarded back twice using same mechanism
         */

        const host1 = new BaseHost();
        const host2 = new BaseHost();
        const host3 = new BaseHost();
        const host4 = new BaseHost();

        const com1 = disposables.add(new Communication(host1, 'com1'));
        const com2 = disposables.add(new Communication(host2, 'com2'));
        const com3 = disposables.add(new Communication(host3, 'com3'));
        const com4 = disposables.add(new Communication(host4, 'com4'));

        // 1 to 2
        const com2ChildHost = host1.open();
        com1.registerEnv('com2', com2ChildHost);
        com2.registerMessageHandler(com2ChildHost);

        // 3 to 4
        const com4ChildHost = host3.open();
        com3.registerEnv('com4', com4ChildHost);
        com4.registerMessageHandler(com4ChildHost);

        // 1 to 3
        const com3ChildHost = host1.open();
        com1.registerEnv('com3', com3ChildHost);
        com3.registerMessageHandler(com3ChildHost);

        // instruct 1 to send messages to 4 using 3
        com1.registerEnv('com4', com3ChildHost);

        // instruct 2 to send messages to 4 using 1
        const com1ChildHost = host1.open();
        com1.registerMessageHandler(com1ChildHost);
        com2.registerEnv('com4', com1ChildHost);

        // create a service at 4
        const echoService = {
            echo: (text: string) => `hello ${text}`,
        };
        com4.registerAPI({ id: 'service' }, echoService);

        // call it from 2
        const apiProxy = com2.apiProxy<typeof echoService>({ id: 'com4' }, { id: 'service' });
        expect(await apiProxy.echo('name')).to.eq('hello name');
    });
});
