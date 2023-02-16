import type { Communication } from '../communication';
import type { InitializerOptions } from './types';
import { WindowInitializerService } from '../window-initializer-service';

export const INSTANCE_ID_PARAM_NAME = 'iframe-instance-id';
export interface IIframeInitializerOptions {
    /** the iframe element to launch the environment on */
    iframeElement: HTMLIFrameElement;
    /**
     * custom source url
     * the src should point to an html content
     */
    src?: string;
    /**
     * it will parse the hash params on the other hand and listen to them
     */
    hashParams?: string;
    /**
     * target host for iframe,
     * can be used to isolate environment on cross origin
     *
     * {@link IIframeInitializerOptions.src | src} will overrule this
     * @example `http://127.0.0.1`
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
        initialize: ({ iframeElement, hashParams, src, origin }: IIframeInitializerOptions) => {
            const publicPath = com.getPublicPath();
            const startIframeParams: StartIframeParams = {
                com,
                envReadyPromise,
                instanceId,
                iframe: iframeElement,
                src: src ?? defaultHtmlSourceFactory(env, publicPath, hashParams, origin),
            };
            return startIframe(startIframeParams);
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

const cancellationTriggers = new WeakMap<HTMLIFrameElement, () => void>();

async function startIframe({ com, iframe, instanceId, src, envReadyPromise }: StartIframeParams): Promise<string> {
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
        const url = new URL(src, window.location.href);

        com.registerEnv(instanceId, contentWindow);
        // pass instance id in query param for engine initialization
        // script that will run in the iframe can pick it up
        url.searchParams.set(INSTANCE_ID_PARAM_NAME, instanceId);
        iframe.src = url.href;

        await Promise.race([waitForCancel, waitForLoad(iframe), envReadyPromise]);

        const api = com.apiProxy<WindowInitializerService>(
            { id: instanceId },
            { id: WindowInitializerService.apiId },
            {
                oncePageHide: {
                    listener: true,
                },
            }
        );
        const postInitHref = await api.getHref();

        if (iframe.contentWindow !== contentWindow || postInitHref !== url.href) {
            throw new Error('Iframe location has changed during environment initialization');
        }

        // pagehide is used on purpose since it is more reliable than onUnload
        // onUnload does not send postMessages on cross origin
        // https://bugs.chromium.org/p/chromium/issues/detail?id=964950
        await api.oncePageHide(() => {
            cleanup();
        });
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
