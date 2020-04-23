import { EnvironmentInitializer, WindowHost } from '../types';
import { Communication } from '../communication';
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
    src,
}: IIframeInitializerOptions): EnvironmentInitializer<{ id: string }> {
    return async (com, { env, endpointType }) => {
        const instanceId = com.getEnvironmentInstanceId(env, endpointType);

        if (!iframeElement) {
            throw new Error('should provide a host provider function to the current iframe to initialize');
        }
        const publicPath = com.getPublicPath();
        managed
            ? await useIframe(
                  com,
                  iframeElement,
                  instanceId,
                  src ?? defaultHtmlSourceFactory(env, publicPath, hashParams)
              )
            : await useWindow(com, iframeElement, instanceId, src ?? defaultSourceFactory(env, publicPath));

        return {
            id: instanceId,
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

const iframeReloadHandlers = new WeakMap<HTMLIFrameElement, () => void>();

async function useIframe(com: Communication, host: HTMLIFrameElement, instanceId: string, src: string): Promise<void> {
    const win = host.contentWindow;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }

    const locationChanged = await changeLocation(win, host, instanceId, src);
    com.registerEnv(instanceId, win);
    if (locationChanged) {
        await com.envReady(instanceId);
    }

    const handleIframeReload = async () => {
        await com.envReady(instanceId);
        com.reconnectHandlers(instanceId);
    };
    const existingReloadHandler = iframeReloadHandlers.get(host);
    if (existingReloadHandler) {
        host.removeEventListener('load', existingReloadHandler);
    }
    iframeReloadHandlers.set(host, handleIframeReload);
    host.addEventListener('load', handleIframeReload);
}

function willUrlChangeCauseReload(oldUrl: URL, newUrl: URL) {
    return (
        oldUrl.origin + oldUrl.pathname + oldUrl.search !==
        newUrl.origin + newUrl.pathname + newUrl.search ||
        !newUrl.hash
    );
}

/**
 * @returns true if navigation has occurred, false if only the hash was updated
 **/
function changeLocation(win: Window, host: HTMLIFrameElement, rootComId: string, iframeSrc: string) {
    // This is the contract of the communication to get the root communication id
    win.name = rootComId;

    return new Promise(resolve => {
        const oldUrl = new URL(win.location.href);
        const newUrl = new URL(iframeSrc, window.location.href);
        if (willUrlChangeCauseReload(oldUrl, newUrl)) {
            host.addEventListener('load', () => resolve(true), { once: true });
            win.location.href = newUrl.href;
        } else {
            win.location.href = newUrl.href;
            resolve(false);
        }
    });
}

const defaultHtmlSourceFactory = (envName: string, publicPath = '', hashParams?: string) => {
    return `${publicPath}${envName}.html${location.search}${hashParams ?? ''}`;
};

const defaultSourceFactory = (envName: string, publicPath = '') => {
    return `${publicPath}${envName}.web.js${location.search}`;
};
