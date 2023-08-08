import External from './application-external.feature.js';
import { server } from '@fixture/base-web-application-feature/dist/base-web-application.feature.js';

External.setup(server, ({}, { baseApp: { serverSlot } }) => {
    serverSlot.register('external');
    return {
        getValue: {
            provider: () => 'from ext',
        },
    };
});
