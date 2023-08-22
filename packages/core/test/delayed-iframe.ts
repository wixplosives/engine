import { Communication, INSTANCE_ID_PARAM_NAME, WindowInitializerService } from '@wixc3/engine-core';
import { TestService } from './test-api-service.js';

setTimeout(() => {
    const options = new URLSearchParams(window.location.search);
    const instanceId = options.get(INSTANCE_ID_PARAM_NAME)!;
    const com = new Communication(window, instanceId);
    com.registerAPI({ id: WindowInitializerService.apiId }, new WindowInitializerService());
    com.registerAPI({ id: 'TestService' }, new TestService());
}, 1000);
