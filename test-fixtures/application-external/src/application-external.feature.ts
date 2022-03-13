import { Feature } from '@wixc3/engine-core';
import { Service } from '@wixc3/engine-com';

import BaseApp, { server } from '@fixture/base-web-application-feature/dist/base-web-application.feature';

export default new Feature({
    id: 'extenalFeature',
    api: {
        getValue: Service.withType<{ provider: () => string }>().defineEntity(server).allowRemoteAccess(),
    },
    dependencies: [BaseApp],
});
