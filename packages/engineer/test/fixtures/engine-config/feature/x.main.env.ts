import { socketServerInitializer } from '@wixc3/engine-core';
import sampleFeature, { MAIN, NODE_1, NODE_2 } from './x.feature';

sampleFeature.setup(MAIN, ({ node_env_1, node_env_2, run }, { COM: { startEnvironment } }) => {
    document.body.textContent = `pid_1;$pid_2`;
    run(async () => {
        await startEnvironment(NODE_1, socketServerInitializer());
        await startEnvironment(NODE_2, socketServerInitializer());
        const pid_1 = await node_env_1.getPid();
        const pid_2 = await node_env_2.getPid();
        document.body.textContent = `${pid_1};${pid_2}`;
    });
});
