import { expect } from 'chai';
import { deferred, waitFor } from 'promise-assist';
import {
    Communication,
    Environment,
    declareComEmitter,
    iframeInitializer,
    deferredIframeInitializer,
} from '@wixc3/engine-core';
import { createDisposables } from '@wixc3/create-disposables';
import {
    type TestServiceData,
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    testServiceId,
    HashParamsRetriever,
    hashParamsRetriever,
    testServiceError,
} from './test-api-service.js';

describe('Communication API', function () {
    this.timeout(15_000);

    const disposables = createDisposables();
    afterEach(() => disposables.dispose());

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
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });
        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('allows providing custom src', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const iframeElement = createIframe();
        const { initialize } = deferredIframeInitializer({
            communication: com,
            env: iframeEnv,
        });
        const testContent = 'hello world';
        const src = `iframe.html?optional_message=${testContent}`;

        await initialize({
            iframeElement,
            src,
        });
        expect(iframeElement.contentWindow?.document.body.textContent?.trim()).to.eq(testContent);
    });

    it('should proxy exceptions thrown in remote service api', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = await iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const error = (await api.failWithError().catch((e) => e)) as typeof testServiceError;

        expect(error).to.be.instanceOf(Error);

        expect(error.code).to.deep.equal(testServiceError.code);
        expect(error.message).to.string(testServiceError.message);
        expect(error.name).to.string(testServiceError.name);
    });

    it('should listen to remote api callbacks', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });
        const api = com.apiProxy<TestService>(env, { id: testServiceId }, declareComEmitter('listen', '', ''));
        const capturedCalls: TestServiceData[] = [];
        await api.listen((data) => capturedCalls.push(data));

        await api.testApi(1, 2, 3);
        await api.testApi(3, 2, 1);

        expect(capturedCalls).to.eql([{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }]);
    });

    it('handles a multi tenant function in api services', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<MultiTenantTestService>(env, { id: multiTanentServiceId });

        const result = await api.multiTenantFunction('test');

        expect(result).to.eql({
            id: com.getEnvironmentId(),
            anotherArg: 'test',
        });
    });

    it('handles a single tenant function in api services that have multi tenant functions', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() });

        const api = com.apiProxy<MultiTenantTestService>(env, { id: multiTanentServiceId });

        const result = await api.singleTenantFunction('id', 'test');

        expect(result).to.eql({
            id: 'id',
            anotherArg: 'test',
        });
    });

    it('listen to multiple environment with the same api (iframe)', async () => {
        const com = new Communication(window, comId);
        disposables.add(com);

        const [env1, env2] = await Promise.all([
            iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() }),
            iframeInitializer({ communication: com, env: iframeEnv, iframeElement: createIframe() }),
        ]);

        const api1 = com.apiProxy<TestService>(env1, { id: testServiceId }, { listen: { listener: true } });
        const api2 = com.apiProxy<TestService>(env2, { id: testServiceId }, { listen: { listener: true } });

        const capturedCallsApi1: TestServiceData[] = [];
        const capturedCallsApi2: TestServiceData[] = [];
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
        const com = new Communication(window, comId);
        disposables.add(com);

        const delayedIframeEnv = new Environment('delayed-iframe', 'iframe', 'multi');

        const env = iframeInitializer({
            communication: com,
            env: delayedIframeEnv,
            iframeElement: createIframe(),
        });

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('allows initiating iframe environment with parameters', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = await iframeInitializer({
            communication: com,
            env: iframeEnv,
            iframeElement: createIframe(),
            hashParams: '#test',
        });

        const api = com.apiProxy<HashParamsRetriever>(env, { id: hashParamsRetriever });

        await waitFor(async () => {
            const deserializedHash = decodeURIComponent(await api.getHashParams());
            expect(deserializedHash).to.eq(`#test`);
        });
    });

    it('should allow to load iframe after receiving its token id', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = new Communication(window, comId);
        disposables.add(com);

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
        const com = new Communication(window, comId);
        disposables.add(com);

        const env = deferredIframeInitializer({ communication: com, env: iframeEnv });

        const api = com.apiProxy<TestService>(
            env,
            { id: testServiceId },
            {
                listen: {
                    listener: true,
                },
            },
        );
        const { promise, resolve } = deferred<TestServiceData>();

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
});
