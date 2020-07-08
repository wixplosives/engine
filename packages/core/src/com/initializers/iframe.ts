import type { EnvironmentInitializer, WindowHost } from '../types';
import type { Communication } from '../communication';
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
        const publicPath = com.getPublicPath();
        const id = managed
            ? await useIframe(
                  com,
                  iframeElement,
                  instanceId,
                  src ?? defaultHtmlSourceFactory(env, publicPath, hashParams)
              )
            : await useWindow(com, iframeElement, instanceId, src ?? defaultSourceFactory(env, publicPath));

        return { id };
    };
}

async function useWindow(com: Communication, host: WindowHost, instanceId: string, src: string): Promise<string> {
    const win = isIframe(host) ? host.contentWindow : host;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }
    com.registerEnv(instanceId, win);
    await injectScript(win, instanceId, src);
    await com.envReady(instanceId);
    return instanceId;
}

const cancellationTriggers = new WeakMap<HTMLIFrameElement, () => void>();

async function useIframe(
    com: Communication,
    iframe: HTMLIFrameElement,
    instanceId: string,
    src: string
): Promise<string> {
    if (!iframe.contentWindow) {
        throw new Error('Cannot initialize environment in a detached iframe');
    }

    cancellationTriggers.get(iframe)?.();

    const waitForCancel = new Promise((_, reject) => {
        cancellationTriggers.set(iframe, () => {
            reject('Cancelled environment initialization in an iframe');
        });
    });

    // If the iframe already has a page loaded into it, that page doesn't immediately
    // get disposed on URL change, and its scripts keep running. Changing `window.name`
    // before the old page has unloaded could cause it to incorrectly use the new
    // environment's ID as its own. To prevent any kinds of race conditions we wait
    // for the old page to fully unload before initializing the new one.
    //
    // The consumers might be listening to the iframe's URL changes to detect when
    // the iframe's contents were lost after it had been moved in the DOM. Changing
    // the URL to 'about:blank' would inadvertently trigger that detection, to avoid
    // this we add an unused URL param '?not-blank'.

    if (!iframe.contentWindow.location.href.startsWith('about:blank')) {
        iframe.contentWindow.location.href = 'about:blank?not-blank';
        await Promise.race([waitForCancel, waitForLoad(iframe)]);
    }

    if (!iframe.contentWindow.location.href.startsWith('about:blank')) {
        throw new Error('Iframe location has changed during environment initialization');
    }

    const cleanup = () => com.clearEnvironment(instanceId);

    try {
        const href = new URL(src, window.location.href).href;
        const contentWindow = iframe.contentWindow;
        contentWindow.name = instanceId;
        com.registerEnv(instanceId, contentWindow);
        contentWindow.location.href = href;

        await Promise.race([waitForCancel, waitForLoad(iframe)]);

        if (iframe.contentWindow !== contentWindow || iframe.contentWindow.location.href !== href) {
            throw new Error('Iframe location has changed during environment initialization');
        }

        contentWindow.addEventListener('unload', cleanup);
        await Promise.race([waitForCancel, com.envReady(instanceId)]);

        cancellationTriggers.delete(iframe);
        return instanceId;
    } catch (e) {
        cleanup();
        throw e;
    }
}

const waitForLoad = (elem: HTMLElement) =>
    new Promise((resolve) => elem.addEventListener('load', resolve, { once: true }));

const defaultHtmlSourceFactory = (envName: string, publicPath = '', hashParams?: string) => {
    return `${publicPath}${envName}.html${location.search}${hashParams ?? ''}`;
};

const defaultSourceFactory = (envName: string, publicPath = '') => {
    return `${publicPath}${envName}.web.js${location.search}`;
};
