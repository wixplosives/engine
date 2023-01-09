import { Feature, Service } from '@wixc3/engine-core';
import BaseApp, { server } from '@fixture/base-web-application-feature/dist/base-web-application.feature';

export default class ExtenalFeature extends Feature<'extenalFeature'> {
    id = 'extenalFeature' as const;
    api = {
        getValue: Service.withType<{
            provider: () => string;
        }>()
            .defineEntity(server)
            .allowRemoteAccess(),
    };
    dependencies = [BaseApp];
}
