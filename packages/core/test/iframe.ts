import { Communication, INSTANCE_ID_PARAM_NAME, WindowInitializerService } from '@wixc3/engine-core';
import {
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    hashParamsRetriever,
    HashParamsRetriever,
} from './test-api-service';

const options = new URLSearchParams(window.location.search);
const instanceId = options.get(INSTANCE_ID_PARAM_NAME)!;
const com = new Communication(window, self.name || instanceId);
com.registerAPI({ id: WindowInitializerService.apiId }, new WindowInitializerService());
com.registerAPI({ id: 'TestService' }, new TestService());
com.registerAPI({ id: multiTanentServiceId }, new MultiTenantTestService());
com.registerAPI({ id: hashParamsRetriever }, new HashParamsRetriever());
