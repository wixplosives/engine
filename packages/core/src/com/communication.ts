import {
    CALLBACK_TIMEOUT,
    DUPLICATE_REGISTER,
    MISSING_ENV,
    MISSING_FORWARD_FOR_MESSAGE,
    REMOTE_CALL_FAILED,
    reportError,
    UNKNOWN_CALLBACK_ID
} from './errors';
import { isIframe, isWindow, isWorkerContext, MultiCounter } from './helpers';
import {
    CallbackMessage,
    CallMessage,
    EventMessage,
    ListenMessage,
    UnListenMessage,
    Message,
    ReadyMessage
} from './message-types';
import {
    APIService,
    AsyncApi,
    CallbackRecord,
    EnvironmentInstanceToken,
    EnvironmentRecord,
    RemoteAPIServicesMapping,
    SerializableArguments,
    SerializableMethod,
    Target,
    UnknownFunction,
    WindowHost,
    AnyServiceMethodOptions,
    ServiceComConfig,
    ILiveEnvironment
} from './types';

import { SERVICE_CONFIG } from '../symbols';

import { SetMultiMap } from '../helpers';
import { Environment, SingleEndpointContextualEnvironment } from '../entities/env';
import { IDTag } from '../types';
import { BaseHost } from './base-host';
import { WsClientHost } from './ws-client-host';

export interface ICommunicationOptions {
    warnOnSlow?: boolean;
    publicPath?: string;
}

/**
 * Manages all API registrations and message forwarding
 * in each execution context.
 */
export class Communication {
    private rootEnvId: string;
    private rootEnvName: string;
    private idsCounter = new MultiCounter();
    private readonly callbackTimeout = 60_000 * 2; // 2 minutes
    private readonly slowThreshold = 5_000; // 5 seconds
    private callbacks: { [callbackId: string]: CallbackRecord<unknown> } = {};
    private environments: { [environmentId: string]: EnvironmentRecord } = {};
    private pendingEnvs: Map<string, UnknownFunction> = new Map();
    private pendingMessages = new SetMultiMap<string, UnknownFunction>();
    private handlers: Map<string, UnknownFunction[]> = new Map();
    private eventDispatchers: { [dispatcherId: string]: SerializableMethod } = {};
    private apis: RemoteAPIServicesMapping = {};
    private apisOverrides: RemoteAPIServicesMapping = {};
    private options: Required<ICommunicationOptions>;

    constructor(
        host: Target,
        id: string,
        private topology: Record<string, string> = {},
        private resolvedContexts: Record<string, string> = {},
        public isServer = false,
        options?: ICommunicationOptions
    ) {
        this.options = { warnOnSlow: false, publicPath: '', ...options };
        this.rootEnvId = id;
        this.rootEnvName = id.split('/')[0];
        this.registerMessageHandler(host);
        this.registerEnv(id, host);
        this.environments['*'] = { id, host };

        this.post(this.getPostEndpoint(host), { type: 'ready', from: id, to: '*', origin: id });
    }

    /**
     * Registers environments that spawned in the same execution context as the root environment.
     */
    public registerEnv(id: string, host: Target): void {
        if (!this.environments[id]) {
            this.environments[id] = { id, host } as EnvironmentRecord;
        } else {
            throw new Error(DUPLICATE_REGISTER(id, 'Environment'));
        }
    }

    /**
     * Registers local api implementation of the remote service.
     */
    public registerAPI<T extends {}>({ id }: IDTag, api: T): T {
        if (!this.apis[id]) {
            this.apis[id] = api;
            this.applyApiDirectives(id, api);
            return api;
        } else {
            throw new Error(DUPLICATE_REGISTER(id, 'RemoteService'));
        }
    }

    public async spawnOrConnect(
        endPoint: SingleEndpointContextualEnvironment<string, Environment[]>
    ): Promise<ILiveEnvironment> {
        const runtimeEnvironmentName = this.resolvedContexts[endPoint.env];

        const activeEnvironment = endPoint.environments.find(env => env.env === runtimeEnvironmentName)!;
        activeEnvironment.env = endPoint.env;

        return activeEnvironment.envType === 'node'
            ? this.connect(activeEnvironment as Environment<string, 'node'>)
            : this.spawn(activeEnvironment);
    }

    public getEnvironmentContext(endPoint: SingleEndpointContextualEnvironment<string, Environment[]>) {
        return this.resolvedContexts[endPoint.env];
    }

    public async spawn(endPoint: Environment, host?: WindowHost) {
        const { endpointType, env, envType } = endPoint;

        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : this.generateEnvInstanceID(env);

        await (envType === 'worker'
            ? this.useWorker(defaultWorkerFactory(env, instanceId, this.options.publicPath), instanceId)
            : this.useWindow(host!, instanceId, defaultSourceFactory(env, instanceId, this.options.publicPath)));

        return {
            id: instanceId
        };
    }

    public async manage(endPoint: Environment, host: HTMLIFrameElement, hashParams?: string) {
        const { endpointType, env } = endPoint;

        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : this.generateEnvInstanceID(env);

        await this.useIframe(
            host,
            instanceId,
            defaultHtmlSourceFactory(env, instanceId, this.options.publicPath, hashParams)
        );

        return {
            id: instanceId
        };
    }

    public async useIframe(host: HTMLIFrameElement, instanceId: string, src: string): Promise<void> {
        const win = host.contentWindow;
        if (!win) {
            throw new Error('cannot spawn detached iframe.');
        }

        await this.changeLocation(win, host, instanceId, src);

        const handlerPrefix = `${this.rootEnvId}__${instanceId}_`;

        const reload = async () => {
            for (const handlerId of this.handlers.keys()) {
                if (handlerId.startsWith(handlerPrefix)) {
                    await this.reconnectHandler(instanceId, this.parseHandlerId(handlerId, handlerPrefix));
                }
            }
        };

        host.addEventListener('load', () => {
            this.envReady(instanceId)
                .then(reload)
                .catch(reportError);
        });

        this.registerEnv(instanceId, win);
        await this.envReady(instanceId);
    }

    /**
     * Connects to a remote node environment
     */
    public async connect(endPoint: Environment<string, 'node'>) {
        const { env, envType } = endPoint;

        const url = this.topology[env];

        if (!url) {
            throw new Error(`Could not find ${envType} topology for ${env}`);
        }

        const instanceId = env;
        const host = new WsClientHost(url);

        this.registerMessageHandler(host);
        this.registerEnv(instanceId, host);
        await host.connected;

        return {
            id: instanceId,
            onDisconnect: (cb: () => void) => {
                host.subscribers.listeners.add('disconnect', cb);
            },
            onReconnect: (cb: () => void) => {
                host.subscribers.listeners.add('reconnect', cb);
            }
        };
    }

    /**
     * Creates a Proxy for a remote service api.
     */
    public apiProxy<T>(
        instanceToken: EnvironmentInstanceToken | Promise<EnvironmentInstanceToken>,
        { id: api }: IDTag,
        serviceComConfig: ServiceComConfig<T> = {}
    ): AsyncApi<T> {
        return new Proxy(Object.create(null), {
            get: (obj, method) => {
                if (typeof method === 'string') {
                    let runtimeMethod = obj[method];
                    if (!runtimeMethod) {
                        runtimeMethod = async (...args: unknown[]) =>
                            this.callMethod(
                                (await instanceToken).id,
                                api,
                                method,
                                args,
                                this.rootEnvId,
                                serviceComConfig as Record<string, AnyServiceMethodOptions>
                            );
                        obj[method] = runtimeMethod;
                    }
                    return runtimeMethod;
                }
            }
        });
    }

    /**
     * Add local handle event listener to Target.
     */
    public registerMessageHandler(target: Target): void {
        target.addEventListener('message', this.handleEvent, true);
    }

    /**
     * Generate client id for newly spawned environment.
     */
    public generateEnvInstanceID(name: string): string {
        return this.idsCounter.next(`${name}/`);
    }

    /**
     * Calls a remote method in any opened environment.
     */
    public callMethod(
        envId: string,
        api: string,
        method: string,
        args: unknown[],
        origin: string,
        serviceComConfig: Record<string, AnyServiceMethodOptions>
    ): Promise<unknown> {
        return new Promise((res, rej) => {
            const callbackId = !serviceComConfig[method]?.emitOnly ? this.idsCounter.next('c') : undefined;

            if (this.isListenCall(args) || serviceComConfig[method]?.removeAllListeners) {
                this.addOrRemoveListener(
                    envId,
                    api,
                    method,
                    callbackId,
                    origin,
                    serviceComConfig,
                    args[0] as UnknownFunction,
                    res,
                    rej
                );
            } else {
                const message: CallMessage = {
                    to: envId,
                    from: this.rootEnvId,
                    type: 'call',
                    data: { api, method, args },
                    callbackId,
                    origin
                };
                this.callWithCallback(envId, message, callbackId, res, rej);
            }
        });
    }
    /**
     * handles Communication incoming message.
     */
    public async handleMessage(message: Message): Promise<void> {
        const env = this.environments[message.to];
        if (!env) {
            this.unhandledMessage(message);
            return;
        }
        if (env.id !== this.rootEnvId) {
            await this.forwardMessage(message, env);
            return;
        }
        switch (message.type) {
            case 'call':
                await this.handleCall(message);
                break;
            case 'callback':
                this.handleCallback(message);
                break;
            case 'event':
                this.handleEventMessage(message);
                break;
            case 'listen':
                await this.handleListen(message);
                break;
            case 'unlisten':
                await this.handleUnListen(message);
                break;
            case 'ready':
                this.handleReady(message);
                break;
            default:
                break;
        }
    }

    public async useWorker(worker: Worker, instanceId: string): Promise<void> {
        this.registerMessageHandler(worker);
        this.registerEnv(instanceId, worker);
        await this.envReady(instanceId);
    }

    public async useWindow(host: WindowHost, instanceId: string, src: string): Promise<void> {
        const win = isIframe(host) ? host.contentWindow : host;
        if (!win) {
            throw new Error('cannot spawn detached iframe.');
        }
        await this.injectScript(win, instanceId, src);
        this.registerEnv(instanceId, win);
        await this.envReady(instanceId);
    }

    /**
     * Dispose the Communication and stop listening to messages.
     */
    public dispose(): void {
        for (const { host } of Object.values(this.environments)) {
            if (host instanceof WsClientHost) {
                host.subscribers.clear();
            }
            host.removeEventListener('message', this.handleEvent, true);
        }

        for (const [id, { timerId }] of Object.entries(this.callbacks)) {
            clearTimeout(timerId);
            delete this.callbacks[id];
        }
    }

    public getEnvironmentId() {
        return this.rootEnvId;
    }

    public getEnvironmentName() {
        return this.rootEnvName;
    }

    private parseHandlerId(handlerId: string, prelude: string) {
        const [api, method] = handlerId.slice(prelude.length).split('@');
        return {
            api,
            method,
            handlerId
        };
    }

    private reconnectHandler(instanceId: string, data: ListenMessage['data']) {
        return new Promise((res, rej) => {
            const message: ListenMessage = {
                to: instanceId,
                from: this.rootEnvId,
                type: 'listen',
                data,
                callbackId: this.idsCounter.next('c'),
                origin: this.rootEnvId
            };
            this.createCallbackRecord(message, message.callbackId!, res, rej);
            this.sendTo(instanceId, message);
        });
    }

    private applyApiDirectives(id: string, api: APIService): void {
        const serviceConfig = api[SERVICE_CONFIG];
        if (serviceConfig) {
            this.apisOverrides[id] = {};
            for (const methodName of Object.keys(serviceConfig)) {
                const config = serviceConfig[methodName](api);
                if (config.proxyFunction) {
                    this.apisOverrides[id][methodName] = config.proxyFunction;
                }
            }
        }
    }

    private envReady(instanceId: string): Promise<void> {
        return new Promise<void>(resolve => {
            this.pendingEnvs.set(instanceId, () => resolve());
        });
    }

    private async forwardMessage(message: Message, env: EnvironmentRecord): Promise<void> {
        if (message.type === 'call') {
            const forwardResponse = await this.callMethod(
                env.id,
                message.data.api,
                message.data.method,
                message.data.args,
                message.origin,
                {}
            );

            if (message.callbackId) {
                this.sendTo(message.from, {
                    from: message.to,
                    type: 'callback',
                    to: message.from,
                    data: forwardResponse,
                    callbackId: message.callbackId,
                    origin: message.to
                });
            }
        } else {
            throw new Error(MISSING_FORWARD_FOR_MESSAGE(message));
        }
    }

    private changeLocation(win: Window, host: HTMLIFrameElement, rootComId: string, iframeSrc: string) {
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

    private apiCall(origin: string, api: string, method: string, args: unknown[]): unknown {
        if (this.apisOverrides[api] && this.apisOverrides[api][method]) {
            return this.apisOverrides[api][method](...[origin, ...args]);
        }
        return this.apis[api][method](...args);
    }

    private unhandledMessage(_message: Message): void {
        // console.warn(
        //   `unhandledMessage at ${this.rootEnv} message:\n${JSON.stringify(message, null, 2)}`
        // )
    }
    private addOrRemoveListener(
        envId: string,
        api: string,
        method: string,
        callbackId: string | undefined,
        origin: string,
        serviceComConfig: Record<string, AnyServiceMethodOptions>,
        fn: UnknownFunction,
        res: () => void,
        rej: () => void
    ) {
        const removeListenerRef =
            serviceComConfig[method]?.removeAllListeners || serviceComConfig[method]?.removeListener;

        if (removeListenerRef) {
            const listenerHandlerId = this.getHandlerId(envId, api, removeListenerRef);
            const listenerHandlersBucket = this.handlers.get(listenerHandlerId);
            if (!listenerHandlersBucket) {
                throw new Error('Cannot Remove handler ' + listenerHandlerId);
            }
            if (serviceComConfig[method]?.removeListener) {
                const i = listenerHandlersBucket.indexOf(fn);
                if (i !== -1) {
                    listenerHandlersBucket.splice(i, 1);
                }
            } else {
                listenerHandlersBucket.length = 0;
            }
            if (listenerHandlersBucket.length === 0) {
                // send remove handler call
                const message: UnListenMessage = {
                    to: envId,
                    from: this.rootEnvId,
                    type: 'unlisten',
                    data: {
                        api,
                        method,
                        handlerId: listenerHandlerId
                    },
                    callbackId,
                    origin
                };

                this.callWithCallback(envId, message, callbackId, res, rej);
            } else {
                res();
            }
        } else {
            if (serviceComConfig[method]?.listener) {
                const handlersBucket = this.handlers.get(this.getHandlerId(envId, api, method));

                if (handlersBucket && handlersBucket.length !== 0) {
                    handlersBucket.push(fn);
                    res();
                } else {
                    const message: ListenMessage = {
                        to: envId,
                        from: this.rootEnvId,
                        type: 'listen',
                        data: {
                            api,
                            method,
                            handlerId: this.createHandlerRecord(envId, api, method, fn)
                        },
                        callbackId,
                        origin
                    };

                    this.callWithCallback(envId, message, callbackId, res, rej);
                }
            } else {
                throw new Error(`cannot add listenr to unconfigured method ${api} ${method}`);
            }
        }
    }
    private callWithCallback(
        envId: string,
        message: Message,
        callbackId: string | undefined,
        res: () => void,
        rej: () => void
    ) {
        this.sendTo(envId, message);
        if (callbackId) {
            this.createCallbackRecord(message, message.callbackId!, res, rej);
        } else {
            res();
        }
    }
    private sendTo(envId: string, message: Message): void {
        const start = this.resolveMessageTarget(envId);
        if (!start) {
            throw new Error(MISSING_ENV(envId, Object.keys(this.environments)));
        }
        if (this.pendingEnvs.get(envId)) {
            this.pendingMessages.add(envId, () => this.post(start, message));
        } else {
            this.post(start, message);
        }
    }

    private post(target: Target, message: Message): void {
        if (isWorkerContext(target)) {
            target.postMessage(message);
        } else {
            target.postMessage(message, '*');
        }
    }

    private resolveMessageTarget(envId: string): Target {
        // TODO: make this more logical
        let env = this.environments[envId];
        if (env && env.id !== this.rootEnvId) {
            return env.host;
        } else {
            if (!env) {
                env = this.environments[this.rootEnvId];
            }
            const target = env.host;
            if (target instanceof BaseHost) {
                return target.parent || target;
            }
            return this.getPostEndpoint(target);
        }
    }

    private getPostEndpoint(target: Target): Window | Worker {
        return isWindow(target) ? target.opener || target.parent : target;
    }

    private handleEventMessage(message: EventMessage): void {
        const handlers = this.handlers.get(message.handlerId);
        if (!handlers) {
            return;
        }
        for (const handler of handlers) {
            handler(...message.data);
        }
    }

    private handleReady({ from }: ReadyMessage): void {
        const pendingEnvCb = this.pendingEnvs.get(from);
        if (pendingEnvCb) {
            this.pendingEnvs.delete(from);
            const pendingMessages = this.pendingMessages.get(from);
            if (pendingMessages) {
                for (const postMessage of pendingMessages) {
                    postMessage();
                }
                this.pendingMessages.deleteKey(from);
            }
            pendingEnvCb();
        }
    }
    private async handleUnListen(message: UnListenMessage) {
        const dispatcher = this.eventDispatchers[message.data.handlerId];
        if (dispatcher) {
            delete this.eventDispatchers[message.data.handlerId];
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, [dispatcher]);
            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.from,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId
                });
            }
        }
    }
    private async handleListen(message: ListenMessage): Promise<void> {
        try {
            const dispatcher =
                this.eventDispatchers[message.data.handlerId] || this.createDispatcher(message.from, message);
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, [dispatcher]);

            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.from,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId
                });
            }
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: String(error),
                callbackId: message.callbackId,
                origin: this.rootEnvId
            });
        }
    }

    private async handleCall(message: CallMessage): Promise<void> {
        try {
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, message.data.args);
            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.from,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId
                });
            }
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: String(error.stack),
                callbackId: message.callbackId,
                origin: this.rootEnvId
            });
        }
    }

    private handleCallback(message: CallbackMessage): void {
        const rec = message.callbackId ? this.callbacks[message.callbackId] : null;
        if (rec) {
            message.error ? rec.reject(new Error(REMOTE_CALL_FAILED(message))) : rec.resolve(message.data);
        } else {
            // TODO: only in dev mode
            if (message.callbackId) {
                throw new Error(UNKNOWN_CALLBACK_ID(removeMessageArgs(message)));
            }
        }
    }

    private createDispatcher(envId: string, message: ListenMessage): SerializableMethod {
        const id = message.data.handlerId;
        return (this.eventDispatchers[id] = (...args: SerializableArguments) => {
            this.sendTo(envId, {
                to: envId,
                from: this.rootEnvId,
                type: 'event',
                data: args,
                handlerId: message.data.handlerId,
                origin: this.rootEnvId
            });
        });
    }

    private isListenCall(args: unknown[]): boolean {
        return typeof args[0] === 'function' && args.length === 1;
    }

    // the any is here because issue with typescript and union types Worker | Window have different message handlers
    private handleEvent = ({ data }: any | MessageEvent): void => {
        this.handleMessage(data).catch(reportError);
    };

    private getHandlerId(envId: string, api: string, method: string) {
        return `${this.rootEnvId}__${envId}_${api}@${method}`;
    }
    private createHandlerRecord(envId: string, api: string, method: string, fn: UnknownFunction): string {
        const handlerId = this.getHandlerId(envId, api, method);
        const handlersBucket = this.handlers.get(handlerId);
        handlersBucket ? handlersBucket.push(fn) : this.handlers.set(handlerId, [fn]);
        return handlerId;
    }
    private createCallbackRecord(
        message: Message,
        callbackId: string,
        res: (value: unknown) => void,
        rej: (reason: Error) => void
    ) {
        const resolve = (value: unknown) => {
            delete this.callbacks[callbackId];
            clearTimeout(timerId);
            res(value);
        };
        const reject = (error: Error) => {
            delete this.callbacks[callbackId];
            rej(error);
        };
        if (this.options.warnOnSlow) {
            setTimeout(() => {
                if (this.callbacks[callbackId]) {
                    console.error(CALLBACK_TIMEOUT(callbackId, this.rootEnvId, removeMessageArgs(message)));
                }
            }, this.slowThreshold);
        }

        const timerId = setTimeout(() => {
            reject(new Error(CALLBACK_TIMEOUT(callbackId, this.rootEnvId, removeMessageArgs(message))));
        }, this.callbackTimeout);
        this.callbacks[callbackId] = {
            timerId,
            resolve,
            reject
        };
    }

    private injectScript(win: Window, rootComId: string, scriptUrl: string) {
        return new Promise<Window>((res, rej) => {
            // This is the contract of the communication to get the root communication id
            win.name = rootComId;
            const scriptEl = win.document.createElement('script');
            scriptEl.src = scriptUrl;
            scriptEl.onload = () => res(win);
            scriptEl.onerror = e => rej(e);
            win.document.head.appendChild(scriptEl);
        });
    }
}

/*
 * We only use the default factories so as a solution to pass the config name we append the location.search
 */
const defaultWorkerFactory = (envName: string, instanceId: string, publicPath = '') => {
    return new Worker(`${publicPath}${envName}.webworker.js${location.search}`, { name: instanceId });
};

const defaultSourceFactory = (envName: string, _instanceId: string, publicPath = '') => {
    return `${publicPath}${envName}.web.js${location.search}`;
};

const defaultHtmlSourceFactory = (envName: string, _instanceId: string, publicPath = '', hashParams?: string) => {
    return `${publicPath}${envName}.html${location.search}${hashParams ?? ''}`;
};

const removeMessageArgs = (message: Message): Message => {
    message = { ...message };
    if (message.type === 'call' || message.type === 'callback') {
        const { data } = message;
        if (data && (data as { args?: unknown }).args) {
            (data as { args?: unknown }).args = undefined;
        }
    }
    return message;
};

export function declareComEmitter<T>(
    onMethod: keyof T,
    offMethod: keyof T,
    removeAll?: keyof T
): Record<string, AnyServiceMethodOptions> {
    if (typeof onMethod !== 'string') {
        throw 'onMethod ref must be a string';
    }
    return {
        [onMethod]: { listener: true },
        [offMethod]: { removeListener: onMethod },
        ...(removeAll ? { [removeAll]: { removeAllListeners: onMethod } } : undefined)
    };
}
