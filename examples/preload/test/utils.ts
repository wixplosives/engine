import { startDevServer } from '@wixc3/engineer';
import { createBrowserProvider } from '@wixc3/engine-test-kit';

export const startServerNewProcess = async ({
    projectPath,
    featureName,
}: {
    projectPath: string;
    featureName: string;
}) => {
    const { dispose, devServerFeature } = await startDevServer({
        targetApplicationPath: projectPath,
        featureName,
        autoLaunch: true,
        singleFeature: true,
        nodeEnvironmentsMode: 'forked',
    });

    const runningPort = await new Promise<number>((resolve) => {
        devServerFeature.serverListeningHandlerSlot.register(({ port }) => {
            resolve(port);
        });
    });

    const featureUrl = `http://localhost:${runningPort}/main.html?feature=${featureName}`;

    return { dispose, runningPort, browserProvider: createBrowserProvider(), featureUrl };
};
