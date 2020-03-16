import { EnvironmentInitializer, WindowHost } from '../types';
import { isIframe } from '../helpers';

interface WindowInitializerOptions {
    host?: WindowHost;
}

export function windowInitializer({ host }: WindowInitializerOptions): EnvironmentInitializer {
    return async (communication, { env, endpointType }) => {
        const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
        const win = isIframe(host) ? host.contentWindow : host;
        if (!win) {
            throw new Error('cannot spawn detached iframe.');
        }
        await communication.injectScript(
            win,
            instanceId,
            `${communication.options.publicPath}${env}.web.js${location.search}`
        );
        return {
            id: instanceId
        };
    };
}
