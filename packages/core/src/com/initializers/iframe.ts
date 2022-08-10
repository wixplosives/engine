import type { Communication } from '../communication';
import { injectScript } from '../../helpers';
import type { InitializerOptions } from './types';
import { createIframeMessaging } from '../minimal-window-com';
import { canAccessWindow } from '../..';

export const INSTANCE_ID_PARAM_NAME = 'iframe-instance-id';
export interface IIframeInitializerOptions {
    /** the iframe element to launch the environment on */
    iframeElement: HTMLIFrameElement;
    /**
     * custom source url
     * if launching a managed iframe, the src should point to an html content
     * if launching not managed iframe, the src should point to a js content
     */
    src?: string;
    /**
     * if launching iframe in "managed" mode, it will parse the hash params on the other hand and listen to them
     */
    hashParams?: string;
    /**
     * if true, allows control over ifrsme content via hash parameters also.
     * @default false
     */
    managed?: boolean;
    /**
     * target host for iframe, @property {src} will overrule this
     * @example http://127.0.0.1
     */
    origin?: string;
}

export interface IframeInitializerOptions extends InitializerOptions, IIframeInitializerOptions {}

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
    const envReadyPromise = com.envReady(instanceId);

    return {
        id: instanceId,
        initialize: ({ managed, iframeElement, hashParams, src, origin }: IIframeInitializerOptions) => {
            const publicPath = com.getPublicPath();
            const startIframeParams: StartIframeParams = {
                com,
                envReadyPromise,
                instanceId,
                iframe: iframeElement,
                src:
                    src ??
                    (managed
                        ? defaultHtmlSourceFactory(env, publicPath, hashParams, origin)
                        : defaultSourceFactory(env, publicPath)),
            };
            return managed ? startManagedIframe(startIframeParams) : startIframe(startIframeParams);
        },
    };
}

interface StartIframeParams {
    com: Communication;
    instanceId: string;
    src: string;
    envReadyPromise: Promise<void>;
    iframe: HTMLIFrameElement;
}

async function startIframe({ com, iframe, instanceId, src, envReadyPromise }: StartIframeParams): Promise<string> {
    if (!iframe.contentWindow) {
        throw new Error('cannot spawn detached iframe.');
    }

    iframe.contentWindow.location.search = window.location.search;
    await waitForLoad(iframe);
    const win = iframe.contentWindow;
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
}: StartIframeParams): Promise<string> {
    if (!iframe.contentWindow) {
        throw new Error('Cannot initialize environment in a detached iframe');
    }

    cancellationTriggers.get(iframe)?.();

    const waitForCancel = new Promise((_, reject) => {
        cancellationTriggers.set(iframe, () => {
            reject('Cancelled environment initialization in an iframe');
        });
    });

    const cleanup = () => {
        com.clearEnvironment(instanceId);
    };

    try {
        const contentWindow = iframe.contentWindow;
        com.registerEnv(instanceId, contentWindow);
        const url = new URL(src, window.location.href);
        const search = new URLSearchParams(url.search);
        search.set(INSTANCE_ID_PARAM_NAME, instanceId);
        url.search = search.toString();

        iframe.src = url.href;
        await Promise.race([waitForCancel, waitForLoad(iframe)]);

        // bridge to communicate cross origin windows during initialization
        const iframeBridge = createIframeMessaging(window, contentWindow);
        iframeBridge.registerHandlers();
        const postInitHref = await iframeBridge.call(5000, 'getHref');

        if (iframe.contentWindow !== contentWindow || postInitHref !== url.href) {
            throw new Error('Iframe location has changed during environment initialization');
        }

        if (canAccessWindow(contentWindow)) {
            contentWindow.addEventListener('unload', cleanup);
        } else {
            iframeBridge
                .call(null, 'oncePagehide')
                .then(() => cleanup())
                .catch((e) => {
                    throw e;
                });
        }

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

const defaultHtmlSourceFactory = (envName: string, publicPath = '', hashParams?: string, origin = '') => {
    return `${origin}${publicPath}${envName}.html${location.search}${hashParams ?? ''}`;
};

const defaultSourceFactory = (envName: string, publicPath = '', origin = '') => {
    return `${origin}${publicPath}${envName}.web.js${location.search}`;
};
