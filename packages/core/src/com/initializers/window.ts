import type { EnvironmentInitializer, WindowHost } from '../types';
import { isIframe } from '../helpers';
import { injectScript } from '../../helpers';

interface WindowInitializerOptions {
    host?: WindowHost;
}

export function windowInitializer({ host }: WindowInitializerOptions): EnvironmentInitializer<{ id: string }> {
    return async (communication, { env, endpointType }) => {
        const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
        const win = isIframe(host) ? host.contentWindow : host;
        if (!win) {
            throw new Error('cannot spawn detached iframe.');
        }
        await injectScript(win, instanceId, `${communication.getPublicPath()}${env}.web.js${location.search}`);
        return {
            id: instanceId,
        };
    };
}
