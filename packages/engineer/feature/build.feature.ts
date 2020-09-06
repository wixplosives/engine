import { Feature, Service, Environment, COM } from '@wixc3/engine-core/src';
import type { ApplicationProxyService } from '../src/application-proxy-service';

export const buildEnv = new Environment('build', 'node', 'single');

export default new Feature({
    id: 'buildFeature',
    dependencies: [COM],
    api: {
        application: Service.withType<ApplicationProxyService>().defineEntity(buildEnv).allowRemoteAccess(),
    },
});
