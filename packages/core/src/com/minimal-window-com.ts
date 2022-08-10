interface Message {
    type: string;
}
interface CallMessage<Method extends string> extends Message {
    type: `_call_${Method}`;
    callId: string;
    params: any;
}
interface ReturnMessage<Method extends string> extends Message {
    type: `_return_${Method}`;
    callId: string;
    data: any;
}

function isMessage(arg: any): arg is Message {
    return typeof arg === 'object' && arg !== null && 'type' in arg;
}
const createCallMessageType = <M extends string>(method: M): `_call_${typeof method}` => `_call_${method}`;

const createReturnMessageType = <M extends string>(method: M): `_return_${typeof method}` => `_return_${method}`;

function isCallMessage<Method extends string>(method: Method, arg: any): arg is CallMessage<Method> {
    return isMessage(arg) && arg.type === createCallMessageType(method);
}

function isReturnMessage<Method extends string>(method: Method, arg: any): arg is ReturnMessage<Method> {
    return isMessage(arg) && arg.type === createReturnMessageType(method);
}

type Api = { [key: string]: { handler: (...args: any) => unknown } };

/**
 * Creates minimal api to communicate between two windows via postMessage
 * @param currentWindow
 * @param targetWindow
 * @param api object that represents what methods are callable on remote window
 * results of these handlers will be transferred via postMessage
 * @returns
 */
function createWindowPostMessaging<API extends Api, M extends Extract<keyof API, string>>(
    currentWindow: Window,
    targetWindow: Window,
    api: API
) {
    return {
        registerHandlers: () => {
            const messageHandler = ({ data: message, source }: MessageEvent) => {
                if (isMessage(message)) {
                    const apiEntry = Object.entries(api).find(([method]) => isCallMessage(method, message));
                    if (apiEntry) {
                        const [_method, { handler }] = apiEntry;
                        const method = _method as M;
                        const callMessage = message as CallMessage<M>;

                        Promise.resolve(handler(...callMessage.params))
                            .then((data) => {
                                const returnMessage: ReturnMessage<M> = {
                                    type: createReturnMessageType(method),
                                    data,
                                    callId: callMessage.callId,
                                };
                                source
                                    ? source.postMessage(returnMessage, { targetOrigin: '*' })
                                    : targetWindow.postMessage(returnMessage, '*');
                            })
                            .catch((error) => {
                                throw error;
                            });
                    }
                }
            };

            currentWindow.addEventListener('message', messageHandler, true);
        },
        call: <Method extends M>(
            timeout: number | null,
            method: Method,
            ...params: Parameters<API[Method]['handler']>
        ): Promise<ReturnType<API[Method]['handler']>> => {
            const apiEntry = api[method];

            if (!apiEntry) {
                throw new Error(`unknown method: ${String(method)}`);
            }
            const callId = String(Math.random());
            return new Promise((resolve, reject) => {
                const rejectionTimer = timeout
                    ? setTimeout(() => {
                          reject(new Error('call timeout ' + method));
                      }, timeout)
                    : null;
                const handler = ({ data: message }: MessageEvent) => {
                    if (isReturnMessage(method as any, message) && message.callId === callId) {
                        if (rejectionTimer) {
                            clearTimeout(rejectionTimer);
                        }
                        currentWindow.removeEventListener('message', handler);
                        resolve(message.data);
                    }
                };

                currentWindow.addEventListener('message', handler);

                const message: CallMessage<M> = {
                    type: createCallMessageType(method),
                    params,
                    callId,
                };

                targetWindow.postMessage(message, '*');
            });
        },
    };
}

export function createIframeMessaging(currentWindow: Window, targetWindow: Window) {
    return createWindowPostMessaging(currentWindow, targetWindow, {
        getHref: {
            handler: () => currentWindow.location.href,
        },
        oncePagehide: {
            handler: () =>
                new Promise<void>((resolve) => {
                    // when windows try to communicate across different domains
                    // the only form of communication should be via .postMessage
                    // with onUnload handler all postMessage handlers will be ignored
                    // see issue https://bugs.chromium.org/p/chromium/issues/detail?id=964950
                    // pagehide seems to work reliably
                    currentWindow.addEventListener('pagehide', () => {
                        resolve();
                    });
                }),
        },
    });
}
