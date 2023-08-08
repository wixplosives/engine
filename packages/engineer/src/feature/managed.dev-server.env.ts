import type { IProcessMessage } from '@wixc3/engine-runtime-node';
import type { IFeatureMessagePayload, IFeatureTarget, IPortMessage } from '@wixc3/engine-scripts';
import { devServerEnv } from './dev-server.feature.js';
import type { ServerListeningParams } from './dev-server.types.js';
import managedFeature from './managed.feature.js';

managedFeature.setup(
    devServerEnv,
    (
        _,
        {
            buildFeature: {
                serverListeningHandlerSlot,
                devServerActions: { close: closeServer },
                application,
            },
        },
    ) => {
        const processListener = async ({ id, payload }: IProcessMessage<unknown>) => {
            if (process.send) {
                if (id === 'run-feature') {
                    const responsePayload = await application.runFeature(payload as Required<IFeatureTarget>);
                    process.send({ id: 'feature-initialized', payload: responsePayload });
                }
                if (id === 'close-feature') {
                    await application.closeFeature(payload as IFeatureMessagePayload);
                    process.send({ id: 'feature-closed' });
                }
                if (id === 'server-disconnect') {
                    await closeServer();
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    process.off('message', processListener);
                    process.send({ id: 'server-disconnected' });
                }
                if (id === 'metrics-request') {
                    process.send({
                        id: 'metrics-response',
                        payload: application.getMetrics(),
                    });
                }
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        process.on('message', processListener);

        serverListeningHandlerSlot.register(({ port }: ServerListeningParams) => {
            if (process.send) {
                process.send({ id: 'port-request', payload: { port } } as IProcessMessage<IPortMessage>);
            }
        });
    },
);
