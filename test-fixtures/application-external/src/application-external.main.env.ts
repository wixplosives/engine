import { client } from '@fixture/base-web-application-feature/dist/base-web-application.feature.js';
import External from './application-external.feature.js';

External.setup(client, ({ run, getValue }, { baseApp: { clientSlot, dataProvider } }) => {
    run(async () => {
        clientSlot.register(await getValue.provider());
        clientSlot.register((await dataProvider.getData())[0]!);
    });
});
