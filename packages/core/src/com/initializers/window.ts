import type { WindowHost } from '../types';
import { isIframe } from '../helpers';
import { injectScript } from '../../helpers';
import type { Communication } from '../communication';
import type { Environment } from '../../entities';

interface WindowInitializerOptions {
    host?: WindowHost;
}

export async function windowInitializer(
    communication: Communication,
    { env, endpointType }: Environment,
    { host }: WindowInitializerOptions
) {
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
