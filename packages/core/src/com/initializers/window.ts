import type { WindowHost } from '../types.js';
import { isIframe } from '../helpers.js';
import { injectScript } from '../../helpers/index.js';
import type { InitializerOptions } from './types.js';

interface WindowInitializerOptions extends InitializerOptions {
    host?: WindowHost;
}

export async function windowInitializer({ communication, env: { env, endpointType }, host }: WindowInitializerOptions) {
    const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
    const win = isIframe(host) ? host.contentWindow : host;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }
    await injectScript(win, instanceId, `${communication.getPublicPath()}${env}.web.js${location.search}`);
    return {
        id: instanceId,
    };
}
