import { socketServerInitializer } from '@wixc3/engine-core';
import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { startEnvironment } }) => {
    const getSlotValueButton = document.createElement('button');
    const slotValue = document.createElement('div');
    const echoValue = document.createElement('div');

    getSlotValueButton.id = 'button';
    getSlotValueButton.textContent = 'click me';
    slotValue.id = 'slotValue';
    echoValue.id = 'echoValue';

    document.body.append(getSlotValueButton, slotValue, echoValue);

    getSlotValueButton.onclick = async () => {
        const value = await echoService.slotValue();
        slotValue.innerText = value.join(',');
    };

    run(async () => {
        await startEnvironment(serverEnv, socketServerInitializer());
        echoValue.textContent = await echoService.echo();
    });
});
