import { iframeInitializer } from '@wixc3/engine-core';
import BaseAppFeature, { client, iframe } from './base-web-application.feature';

BaseAppFeature.setup(client, ({ clientSlot }, { COM: { startEnvironment } }) => {
    const registeredSlots = [...clientSlot];
    clientSlot.subscribe((e) => {
        registeredSlots.push(e);
        clientSlotValue.innerText = registeredSlots.join(',');
    });
    const clientSlotTitle = document.createElement('h1');
    clientSlotTitle.id = 'client-slot-title';
    clientSlotTitle.innerText = 'Client Slot Values';

    const clientSlotValue = document.createElement('span');
    clientSlotValue.innerText = [...clientSlot].join(',');

    const iframeElement = document.createElement('iframe');
    iframeElement.id = 'iframe-container';

    document.body.append(clientSlotTitle, clientSlotValue, iframeElement);

    startEnvironment(
        iframe,
        iframeInitializer({
            iframeElement,
        })
    ).catch(console.error);
});
