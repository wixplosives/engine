import { socketServerInitializer } from '@wixc3/engine-core';
import BaseAppFeature, { client, server } from './base-web-application.feature';

BaseAppFeature.setup(client, ({ clientSlot, dataProvider, run }, { COM: { startEnvironment } }) => {
    startEnvironment(server, socketServerInitializer()).catch(console.error);
    run(() => {
        const clientSlotTitle = document.createElement('h1');
        clientSlotTitle.id = 'client-slot-value';
        clientSlotTitle.innerText = 'Client Slot Values';

        const clientSlotValue = document.createElement('span');
        clientSlotValue.innerText = [...clientSlot].join(',');

        const serverSlotTitle = document.createElement('h1');
        serverSlotTitle.id = 'server-slot-value';
        serverSlotTitle.innerText = 'Server Slot Values';

        const serverSlotValue = document.createElement('span');
        serverSlotValue.innerText = '';

        const getSlotValues = document.createElement('button');
        getSlotValues.onclick = async () => {
            const values = await dataProvider.getData();
            serverSlotValue.innerText = values.join(',');
        };
        getSlotValues.innerText = 'Get server slot values';
        getSlotValues.id = 'btn';

        document.body.append(clientSlotTitle, clientSlotValue, serverSlotTitle, serverSlotValue, getSlotValues);
    });
});
