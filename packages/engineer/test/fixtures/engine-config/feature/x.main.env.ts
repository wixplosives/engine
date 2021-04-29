import { socketServerInitializer } from '@wixc3/engine-core';
import sampleFeature, { MAIN, NODE_1, NODE_2 } from './x.feature';

sampleFeature.setup(MAIN, ({ nodeEnv1, nodeEnv2, run }, { COM: { startEnvironment } }) => {
    document.body.textContent = `pid_1;$pid_2`;
    run(async () => {
        await startEnvironment(NODE_1, socketServerInitializer());
        await startEnvironment(NODE_2, socketServerInitializer());
        const pid1 = await nodeEnv1.getPid();
        const pid2 = await nodeEnv2.getPid();
        document.body.textContent = `${pid1};${pid2}`;
    });
});
