import { serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(serverEnv, ({ config, aSlot }) => {
    return {
        echoService: {
            echo: () => config.value,
            slotValue: () => [...aSlot],
        },
    };
});
