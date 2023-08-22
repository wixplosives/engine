import External from './application-external.feature.js';
import { client } from '@fixture/static-base-web-application-feature/dist/base-web-application.feature.js';

External.setup(client, ({ run }, { baseApp: { clientSlot } }) => {
    run(() => {
        clientSlot.register('client from external');
    });
});
