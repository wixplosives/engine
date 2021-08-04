import type { WindowHost } from '../types';
import type { Communication } from '../communication';
import { isIframe } from '../helpers';
import { injectScript } from '../../helpers';
import type { InitializerOptions } from './types';

export interface IIframeInitializerOptions {
    iframeElement: HTMLIFrameElement;
    src?: string;
    hashParams?: string;
    managed?: boolean;
}

export interface IframeInitializerOptions extends InitializerOptions, IIframeInitializerOptions { }

export async function iframeInitializer({
    communication,
    env,
    ...initializerOptions
}: IframeInitializerOptions): Promise<{ id: string }> {
    const { initialize } = deferredIframeInitializer({ communication, env });
    const id = await initialize(initializerOptions);
    return {
        id,
    };
}

export function deferredIframeInitializer({ communication: com, env: { env, endpointType } }: InitializerOptions): {
    id: string;
    initialize: (options: IIframeInitializerOptions) => Promise<string>;
} {
    const instanceId = com.getEnvironmentInstanceId(env, endpointType);
    const envReadyPromise = com.envReady(instanceId)
    return {
        id: instanceId,
        initialize: ({ managed, iframeElement, hashParams, src }: IIframeInitializerOptions) => {
            const publicPath = com.getPublicPath();
            const baseStartIframeParams: StartIframeBaseOptions = {
                com,
                envReadyPromise,
                instanceId,
                src:
                    src ?? managed
                        ? defaultHtmlSourceFactory(env, publicPath, hashParams)
                        : defaultSourceFactory(env, publicPath),
            };
            return managed
                ? startManagedIframe({
                    ...baseStartIframeParams,
                    iframe: iframeElement,
                })
                : startIframe({
                    ...baseStartIframeParams,
                    host: iframeElement,
                });
        },
    };
}

interface StartIframeBaseOptions {
    com: Communication;
    instanceId: string;
    src: string;
    envReadyPromise: Promise<void>;
}

interface StartIframeParams extends StartIframeBaseOptions {
    host: WindowHost;
}

interface StartManagedIframeParams extends StartIframeBaseOptions {
    iframe: HTMLIFrameElement;
}

async function startIframe({ com, host, instanceId, src, envReadyPromise }: StartIframeParams): Promise<string> {
    const win = isIframe(host) ? host.contentWindow : host;
    if (!win) {
        throw new Error('cannot spawn detached iframe.');
    }
    com.registerEnv(instanceId, win);
    await injectScript(win, instanceId, src);
    await envReadyPromise;
    return instanceId;
}

const cancellationTriggers = new WeakMap<HTMLIFrameElement, () => void>();

async function startManagedIframe({
    com,
    iframe,
    instanceId,
    src,
    envReadyPromise,
}: StartManagedIframeParams): Promise<string> {
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
        iframe.contentWindow.location.replace('about:blank?not-blank');
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
        contentWindow.location.replace(href);
        await Promise.race([waitForCancel, waitForLoad(iframe)]);

        if (iframe.contentWindow !== contentWindow || iframe.contentWindow.location.href !== href) {
            throw new Error('Iframe location has changed during environment initialization');
        }

        contentWindow.addEventListener('unload', cleanup);
        await Promise.race([waitForCancel, envReadyPromise]);

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
