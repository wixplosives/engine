import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { createDisposables, Communication, Environment, declareComEmitter, iframeInitializer } from '../src';
import {
    ITestServiceData,
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    testServiceId,
    HashParamsRetriever,
    hashParamsRetriever,
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

        const env = await com.startEnvironment(
            iframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
            })
        );

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('should listen to remote api callbacks', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = await com.startEnvironment(
            iframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
            })
        );

        const api = com.apiProxy<TestService>(env, { id: testServiceId }, declareComEmitter('listen', '', ''));
        const capturedCalls: ITestServiceData[] = [];
        await api.listen((data) => capturedCalls.push(data));

        await api.testApi(1, 2, 3);
        await api.testApi(3, 2, 1);

        expect(capturedCalls).to.eql([{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }]);
    });

    it('handles a multi tenant function in api services', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = await com.startEnvironment(
            iframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
            })
        );

        const api = com.apiProxy<MultiTenantTestService>(env, { id: multiTanentServiceId });

        const result = await api.multiTenantFunction('test');

        expect(result).to.eql({
            id: com.getEnvironmentId(),
            anotherArg: 'test',
        });
    });

    it('handles a single tanent function in api services that have multi tanent functions', async () => {
        const com = disposables.add(new Communication(window, comId));

        const env = await com.startEnvironment(
            iframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
            })
        );

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
            com.startEnvironment(
                iframeEnv,
                iframeInitializer({
                    iframeElement: createIframe(),
                })
            ),
            com.startEnvironment(
                iframeEnv,
                iframeInitializer({
                    iframeElement: createIframe(),
                })
            ),
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

        const env = await com.startEnvironment(
            delayedIframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
                managed: false,
            })
        );

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);

        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('allows initiating iframe environment with parameters', async () => {
        const iframeEnv = new Environment('iframe', 'iframe', 'multi');
        const com = disposables.add(new Communication(window, comId));
        const env = await com.startEnvironment(
            iframeEnv,
            iframeInitializer({
                iframeElement: createIframe(),
                hashParams: '#test',
                managed: true,
            })
        );
        const api = com.apiProxy<HashParamsRetriever>(env, { id: hashParamsRetriever });

        await waitFor(async () => {
            const deserializedHash = decodeURIComponent(await api.getHashParams());
            expect(deserializedHash).to.eq(`#test`);
        });
    });
});
