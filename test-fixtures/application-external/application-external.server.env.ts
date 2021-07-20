import External from './application-external.feature';
import { server } from '@fixture/base-web-application-feature/base-web-application.feature';

External.setup(server, ({}, { baseApp: { serverSlot } }) => {
    serverSlot.register('external');
    return {
        getValue: {
            provider: () => 'from ext',
        },
    };
});
