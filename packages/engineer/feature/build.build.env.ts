import buildFeature, { buildEnv } from './build.feature';
import { Application } from '@wixc3/engine-scripts/src';
import { ApplicationProxyService } from '../src/application-proxy-service';
import { ConfigService } from '../src/config-service';
import { cwd } from 'process';

buildFeature.setup(buildEnv, ({ run }) => {
    const application = new Application({ basePath: cwd() });
    const configService = new ConfigService();
    run(async () => {
        await application.start();
    });
    return { application: new ApplicationProxyService(application), configService };
});
