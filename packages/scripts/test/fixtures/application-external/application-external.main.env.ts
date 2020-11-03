import External from './application-external.feature';
import { client } from '@fixture/base-web-application-feature/base-web-application.feature';

External.setup(client, ({ run, getValue }, { baseApp: { clientSlot, dataProvider } }) => {
    run(async () => {
        clientSlot.register((await getValue.provider())[0]);
        clientSlot.register((await dataProvider.getData())[0]);
    });
});
