import { EnvironmentInitializer, WindowHost } from '../types';
import { isIframe } from '../helpers';

interface WindowInitializerOptions {
    host?: WindowHost;
}

export function windowInitializer(options: WindowInitializerOptions = {}): EnvironmentInitializer {
    return async (communication, { env, endpointType }) => {
        const { host = window } = options;
        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);
        const win = isIframe(host) ? host.contentWindow : host;
        if (!win) {
            throw new Error('cannot spawn detached iframe.');
        }
        await communication.injectScript(
            win,
            instanceId,
            `${communication.options.publicPath}${env}.web.js${location.search}`
        );
        communication.registerEnv(instanceId, win);
        await communication.envReady(instanceId);
        return {
            id: instanceId
        };
    };
}
