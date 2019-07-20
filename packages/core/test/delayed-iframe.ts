import { Communication } from '../src';
import { TestService } from './test-api-service';

setTimeout(() => {
    const com = new Communication(window, self.name);
    com.registerAPI({ id: 'TestService' }, new TestService());
}, 1000);
