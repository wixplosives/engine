import { Communication } from '../src';
import { multiTanentServiceId, MultiTenantTestService, TestService } from './test-api-service';

const com = new Communication(window, self.name);
com.registerAPI({ id: 'TestService' }, new TestService());
com.registerAPI({ id: multiTanentServiceId }, new MultiTenantTestService());
