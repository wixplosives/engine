import { expect } from 'chai';
import { waitFor } from 'promise-assist';
import { ComBrowserTestKit } from './com-browser-test-kit';
import {
    ITestServiceData,
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    testServiceId
} from './test-api-service';

describe('Communication API', function() {
    this.timeout(10_000);

    const syncIframe = 'iframe';
    const tk = new ComBrowserTestKit();

    afterEach(() => tk.dispose());

    it('should proxy remote service api', async () => {
        const com = tk.createTestCom();
        const env = await tk.createTestIframe(com, syncIframe);
        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);
        expect(res).to.eql({ echo: [1, 2, 3] });
    });

    it('should listen to remote api callbacks', async () => {
        const com = tk.createTestCom();
        const env = await tk.createTestIframe(com, syncIframe);

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const expectedCalls = [{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }];

        return new Promise(res => {
            api.listen(data => {
                expect(data).to.eql(expectedCalls.shift());
                if (expectedCalls.length === 0) {
                    res();
                }
            });

            api.testApi(1, 2, 3);
            api.testApi(3, 2, 1);
        });
    });

    it('handles a multi tenant function in api services', async () => {
        const com = tk.createTestCom();
        const iframeEnv = await tk.createTestIframe(com, syncIframe);

        const api = com.apiProxy<MultiTenantTestService>(iframeEnv, { id: multiTanentServiceId });
        const expectedResult = {
            id: com.getEnvironmentId(),
            anotherArg: 'test'
        };
        const result = await api.multiTenantFunction('test');
        expect(result).to.eql(expectedResult);
    });

    it('handles a single tanent function in api services that have multi tanent functions', async () => {
        const com = tk.createTestCom();
        const iframeEnv = await tk.createTestIframe(com, syncIframe);

        const api = com.apiProxy<MultiTenantTestService>(iframeEnv, { id: multiTanentServiceId });
        const expectedResult = {
            id: 'id',
            anotherArg: 'test'
        };

        const result = await api.singleTenantFunction('id', 'test');
        expect(result).to.eql(expectedResult);
    });

    it('listen to multiple environment with the same api (iframe)', async () => {
        const com = tk.createTestCom();
        const [env1, env2] = await Promise.all([
            tk.createTestIframe(com, syncIframe),
            tk.createTestIframe(com, syncIframe)
        ]);
        const api1 = com.apiProxy<TestService>(env1, { id: testServiceId });
        const api2 = com.apiProxy<TestService>(env2, { id: testServiceId });

        const capturedCallsApi1: ITestServiceData[] = [];
        const capturedCallsApi2: ITestServiceData[] = [];
        api1.listen(data => capturedCallsApi1.push(data));
        api2.listen(data => capturedCallsApi2.push(data));

        api1.testApi(1, 2, 3);
        api1.testApi(3, 2, 1);

        api2.testApi(7, 8, 9);
        api2.testApi(9, 8, 7);

        await waitFor(() => {
            expect(capturedCallsApi1, 'capturedCallsApi1').to.eql([{ echo: [1, 2, 3] }, { echo: [3, 2, 1] }]);
            expect(capturedCallsApi2, 'capturedCallsApi2').to.eql([{ echo: [7, 8, 9] }, { echo: [9, 8, 7] }]);
        });
    });

    it('resolves spawn only when com is ready', async () => {
        const com = tk.createTestCom();
        const env = await tk.createTestIframe(com, 'delayed-iframe');

        const api = com.apiProxy<TestService>(env, { id: testServiceId });
        const res = await api.testApi(1, 2, 3);
        expect(res).to.eql({ echo: [1, 2, 3] });
    });
});
