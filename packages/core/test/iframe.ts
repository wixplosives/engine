import { Communication } from '../src';
import {
    multiTanentServiceId,
    MultiTenantTestService,
    TestService,
    hashParamsRetriever,
    HashParamsRetriever,
} from './test-api-service';

const com = new Communication(window, self.name);
com.registerAPI({ id: 'TestService' }, new TestService());
com.registerAPI({ id: multiTanentServiceId }, new MultiTenantTestService());
com.registerAPI({ id: hashParamsRetriever }, new HashParamsRetriever());
