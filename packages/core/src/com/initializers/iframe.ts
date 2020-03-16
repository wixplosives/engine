import { EnvironmentInitializer, WindowHost } from '../types';
import { Communication } from '../communication';
import { reportError } from '../errors';
import { isIframe } from '../helpers';
import { injectScript } from '../../helpers';

export interface IIframeInitializerOptions {
    iframeElement: HTMLIFrameElement;
    src?: string;
    hashParams?: string;
    managed?: boolean;
}

export function iframeInitializer({
    hashParams,
    iframeElement,
    managed,
    src
}: IIframeInitializerOptions): EnvironmentInitializer {
    return async (com, { env, endpointType }) => {
        const instanceId = com.getEnvironmentInstanceId(env, endpointType);

        if (!iframeElement) {
            throw new Error('should provide a host provider function to the current iframe to initialize');
        }

        managed
            ? await useIframe(
                  com,
                  iframeElement,
                  instanceId,
                  src ?? defaultHtmlSourceFactory(env, com.options.publicPath, hashParams)
              )
            : await useWindow(com, iframeElement, instanceId, src ?? defaultSourceFactory(env, com.options.publicPath));

        return {
            id: instanceId
        };
    };
}
async function useWindow(com: Communication, host: WindowHost, instanceId: string, src: string): Promise<void> {
    const win = isIframe(host) ? host.contentWindow : host;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }
    com.registerEnv(instanceId, win);
    await injectScript(win, instanceId, src);
    await com.envReady(instanceId);
}

async function useIframe(com: Communication, host: HTMLIFrameElement, instanceId: string, src: string): Promise<void> {
    const win = host.contentWindow;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }

    await changeLocation(win, host, instanceId, src);

    const reload = () => com.reconnectHandlers(instanceId);
    host.addEventListener('load', () => {
        com.envReady(instanceId)
            .then(reload)
            .catch(reportError);
    });

    com.registerEnv(instanceId, win);
    await com.envReady(instanceId);
}

function changeLocation(win: Window, host: HTMLIFrameElement, rootComId: string, iframeSrc: string) {
    return new Promise<Window>((res, rej) => {
        // This is the contract of the communication to get the root communication id
        win.name = rootComId;
        const loaded = () => {
            host.removeEventListener('load', loaded);
            res();
        };
        host.addEventListener('load', loaded);
        host.addEventListener('error', () => rej());
        win.location.href = iframeSrc;
    });
}

const defaultHtmlSourceFactory = (envName: string, publicPath = '', hashParams?: string) => {
    return `${publicPath}${envName}.html${location.search}${hashParams ?? ''}`;
};

const defaultSourceFactory = (envName: string, publicPath = '') => {
    return `${publicPath}${envName}.web.js${location.search}`;
};
