import { isDisposable, SetMultiMap } from '@wixc3/patterns';
import { deferred } from 'promise-assist';
import type { ContextualEnvironment, Environment, EnvironmentMode } from '../entities/env.js';
import { errorToJson } from '../helpers/index.js';
import { SERVICE_CONFIG } from '../symbols.js';
import { type IDTag } from '../types.js';
import { reportError } from './logs.js';
import {
    countValues,
    deserializeApiCallArguments,
    getPostEndpoint,
    isListenCall,
    isWorkerContext,
    MultiCounter,
    redactArguments,
    serializeApiCallArguments
} from './helpers.js';
import { BaseHost } from './hosts/base-host.js';
import { WsClientHost } from './hosts/ws-client-host.js';
import type {
    CallbackMessage,
    CallMessage,
    DisposeMessage,
    EventMessage,
    ListenMessage,
    Message,
    StatusMessage,
    UnListenMessage
} from './message-types.js';
import { isMessage } from './message-types.js';
import {
    AnyFunction,
    type AnyServiceMethodOptions,
    type APIService,
    type AsyncApi,
    type CallbackRecord,
    ConfigEnvironmentRecord,
    type EnvironmentInstanceToken,
    type EnvironmentRecord,
    HOST_REMOVED,
    type SerializableMethod,
    type ServiceComConfig,
    type Target,
    type UnknownFunction
} from './types.js';
import {
    CallbackTimeoutError,
    CircularForwardingError,
    DuplicateRegistrationError,
    EnvironmentDisconnectedError,
    UnConfiguredMethodError,
    UnknownCallbackIdError
} from './communication-errors';

/**
 * Manages all API registrations and message forwarding
 * in each execution context.
 */
export class Communication {
    static DEBUG = false;
    private readonly idsCounter = new MultiCounter();
    private readonly callbackTimeout = 60_000 * 5; // 5 minutes
    private readonly slowThreshold = 5_000; // 5 seconds
    private readonly pendingEnvs = new SetMultiMap<string, () => void>();
    private readonly pendingMessages = new SetMultiMap<string, UnknownFunction>();
    private readonly handlers = new Map<string, Set<UnknownFunction>>();
    private readonly eventDispatchers: { [dispatcherId: string]: SerializableMethod } = {};
    private readonly apis: { [remoteServiceId: string]: Record<string, AnyFunction> } = {};
    private readonly apisOverrides: typeof this.apis = {};
    private readonly readyEnvs = new Set<string>();
    private readonly environments: { [environmentId: string]: EnvironmentRecord } = {};
    private readonly messageHandlers = new WeakMap<Target, (options: { data: null | Message }) => void>();
    private readonly disposeListeners = new Set<(envId: string) => void>();
    private readonly pendingCallbacks = new Map<string, CallbackRecord<unknown>>();
    private readonly callbackIdPrefix: string;
    private readonly options: {
        warnOnSlow: boolean;
        publicPath: string;
        connectedEnvironments: { [environmentId: string]: ConfigEnvironmentRecord };
    } = {
        warnOnSlow: Communication.DEBUG,
        publicPath: '',
        connectedEnvironments: {},
    };
    private disposing = false;

    constructor(
        private readonly host: Target,
        private readonly id: string,
        public topology: Record<string, string> = {},
        public resolvedContexts: Record<string, string> = {},
        public isServer = false, // TODO: you need better name, darling, or people won't know who you are and what you do
        options?: Partial<typeof this.options>,
    ) {
        this.options = { ...this.options, ...options };
        this.registerMessageHandler(host);
        this.registerEnv(id, host);
        this.environments['*'] = { id, host };
        this.callbackIdPrefix = `c_${this.id}_${Math.random().toString(36).slice(2)}`;

        for (const [id, envEntry] of Object.entries(this.options.connectedEnvironments)) {
            if (envEntry.registerMessageHandler) {
                this.registerMessageHandler(envEntry.host);
            }
            this.environments[id] = envEntry;
        }
        this.post(getPostEndpoint(host), {
            type: 'ready',
            from: id,
            to: '*',
            origin: id,
        });
    }

    public getEnvironmentId(): string {
        return this.id;
    }

    public getEnvironmentName(): string {
        return this.id.split('/')[0]!;
    }

    public getEnvironmentHost(envName: string): Target | undefined {
        return this.environments[envName]?.host;
    }

    /**
     * Registers environments that spawned in the same execution context as the root environment.
     * If the environment is already registered, it will not be registered again.
     */
    public registerEnv(id: string, host: Target): void {
        const existingEnv = this.environments[id];
        if (existingEnv) {
            if (existingEnv.host !== host) throw new DuplicateRegistrationError(id, 'Environment');

            return;
        }

        this.log(`Registering env ${id} at ${this.id}`);
        this.environments[id] = { id, host };
    }

    /**
     * Registers local api implementation of the remote service.
     */
    public registerAPI<T extends {}>({ id }: IDTag, api: T): T {
        if (this.apis[id]) throw new DuplicateRegistrationError(id, 'RemoteService');

        this.apis[id] = api;
        this.applyApiDirectives(id, api);

        return api;
    }

    public getEnvironmentContext(
        endPoint: ContextualEnvironment<string, EnvironmentMode, Environment[]>,
    ): string | undefined {
        return this.resolvedContexts[endPoint.env];
    }

    public getEnvironmentInstanceId(envName: string, endpointType: EnvironmentMode): string {
        return endpointType === 'single' ? envName : this.generateEnvInstanceID(envName);
    }

    /**
     * Generate client id for newly spawned environment.
     * todo: should be made private? or rather inlined
     */
    public generateEnvInstanceID(name: string): string {
        return this.idsCounter.next(`${name}/`);
    }

    public getPublicPath(): string {
        return this.options.publicPath;
    }

    public subscribeToEnvironmentDispose(handler: (envId: string) => void): void {
        this.disposeListeners.add(handler);
    }

    /**
     * Creates a Proxy for a remote service api.
     */
    public apiProxy<T extends object>(
        instanceToken: EnvironmentInstanceToken | Promise<EnvironmentInstanceToken>,
        { id: api }: IDTag,
        serviceComConfig: ServiceComConfig<T> = {},
    ): AsyncApi<T> {
        return new Proxy(Object.create(null), {
            get: (obj, method) => {
                // let js runtime know that this is not thenable object
                if (method === 'then') {
                    return undefined;
                }

                /*
                 * Don't allow native Object methods to be proxies.
                 * they used by the debugger and cause messages to be sent everywhere
                 * this behavior made debugging very hard and can cause errors and infinite loops
                 */
                if (Object.hasOwn(Object.prototype, method)) {
                    return Reflect.get(Object.prototype, method);
                }
                if (typeof method === 'string') {
                    let runtimeMethod = obj[method];
                    if (!runtimeMethod) {
                        runtimeMethod = async (...args: unknown[]) =>
                            this.callMethod({
                                envId: (await instanceToken).id,
                                api,
                                method,
                                args,
                                origin: this.id,
                                serviceComConfig: serviceComConfig as Record<string, AnyServiceMethodOptions>,
                            });
                        obj[method] = runtimeMethod;
                    }
                    return runtimeMethod;
                }
            },
        });
    }

    /**
     * Add local handle event listener to Target.
     */
    public registerMessageHandler(target: Target): void {
        const envTarget = (target as BaseHost).parent ?? target;
        const onTargetMessage = ({ data, source }: { data: null | Message; source?: Target }) => {
            if (!isMessage(data)) return;
            this.handleMessage(data, source ?? envTarget).catch(reportError);
        };
        target.addEventListener('message', onTargetMessage, true);
        this.messageHandlers.set(target, onTargetMessage);
    }

    /**
     * Remove local handle event listener to Target.
     */
    public removeMessageHandler(target: Target): void {
        const messageHandler = this.messageHandlers.get(target);
        if (messageHandler) {
            target.removeEventListener('message', messageHandler, true);
        }
    }

    /**
     * Calls a remote method in any opened environment.
     * todo: shouldn't it be private?
     */
    public callMethod({
        envId,
        api,
        method,
        args,
        origin,
        serviceComConfig,
    }: {
        envId: string;
        api: string;
        method: string;
        args: unknown[];
        origin: string;
        serviceComConfig: Record<string, AnyServiceMethodOptions>;
    }): Promise<unknown> {
        return new Promise<unknown>((resolve, reject) => {
            const callbackId = serviceComConfig[method]?.emitOnly
                ? undefined
                : this.idsCounter.next(this.callbackIdPrefix);

            if (isListenCall(args) || serviceComConfig[method]?.removeAllListeners) {
                this.addOrRemoveListener({
                    envId,
                    api,
                    method,
                    callbackId,
                    origin,
                    serviceComConfig,
                    resolve,
                    reject,
                    fn: args[0] as UnknownFunction,
                });
            } else {
                this.callWithCallback({
                    envId,
                    message: {
                        type: 'call',
                        origin,
                        from: this.id,
                        to: envId,
                        callbackId,
                        data: { api, method, args: serializeApiCallArguments(args) },
                    },
                    callbackId,
                    resolve,
                    reject,
                });
            }
        });
    }

    /**
     * handles Communication incoming message.
     * todo: public only for logger transport interface compatibility? otherwise should be private
     */
    public async handleMessage(message: unknown, source: Target): Promise<void> {
        if (!isMessage(message)) return;

        if (message.type === 'dispose' && message.to === '*') {
            this.clearEnvironment(message.origin, this.id);
            return;
        }

        if (message.type !== 'dispose') {
            this.autoRegisterEnvFromMessage(message, source);
        }

        const env = this.environments[message.to];

        if (!env) {
            this.log(`Message to unknown environment "${message.to}" received at ${this.id}`, message);
            return;
        }

        if (env.id !== this.id) {
            this.forwardMessage(message, env);
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
                this.handleEvent(message);
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
            case 'dispose':
                this.handleDispose(message);
                break;
            case 'status':
                this.handleStatusRequest(message);
                break;
            default: {
                const _exhaustiveCheck: never = message;
            }
        }
    }

    /**
     * debug method: get all environments statuses
     */
    public async getAllEnvironmentsStatus() {
        type Status = ReturnType<typeof this.getStatus>;
        const statuses: Promise<Status>[] = [];
        const environmentsExcludingOwn = Object.keys(this.environments).filter(
            (envId) => envId !== '*' && envId !== this.id,
        );

        for (const envId of environmentsExcludingOwn) {
            const { promise, resolve, reject } = deferred<Status>();
            const callbackId = this.idsCounter.next(this.callbackIdPrefix);
            this.callWithCallback({
                envId,
                message: {
                    type: 'status',
                    origin: this.id,
                    from: this.id,
                    to: envId,
                    callbackId,
                },
                callbackId,
                resolve,
                reject,
            });
            statuses.push(promise);
        }

        return Promise.allSettled(statuses).then((results) => {
            const statuses: Record<string, Status | PromiseRejectedResult> = {
                [this.id]: this.getStatus(),
            };
            for (let i = 0; i < results.length; i++) {
                const result = results[i]!;
                const key = environmentsExcludingOwn[i]!;
                if (result.status === 'fulfilled') {
                    if (key !== result.value.rootEnvId) {
                        statuses[key + ' -> ' + result.value.rootEnvId] = result.value;
                    } else {
                        statuses[result.value.rootEnvId] = result.value;
                    }
                } else {
                    statuses[key] = result;
                }
            }

            return statuses;
        });
    }

    /**
     * Dispose the Communication and stop listening to messages.
     */
    public async dispose(): Promise<void> {
        this.disposing = true;
        for (const { host, id } of Object.values(this.environments)) {
            if (host instanceof WsClientHost) {
                host.subscribers.clear();
            }
            if (isDisposable(host)) {
                await host.dispose();
            }
            this.removeMessageHandler(host);
            this.locallyClear(id);
        }

        this.locallyClear(this.id);
        this.disposeListeners.clear();
        for (const { timerId } of this.pendingCallbacks.values()) {
            clearTimeout(timerId);
        }
        this.pendingCallbacks.clear();
    }

    /**
     * Gets a list of all registered environment instance ids.
     * @returns the list of instance ids.
     */
    public getRegisteredEnvironmentInstances(): string[] {
        return Object.keys(this.environments).filter((id) => id !== '*');
    }

    public envReady(instanceId: string): Promise<void> {
        if (this.readyEnvs.has(instanceId)) {
            return Promise.resolve();
        }
        const { promise, resolve } = deferred();
        this.pendingEnvs.add(instanceId, resolve);
        return promise;
    }

    public clearEnvironment(instanceId: string, from: string = instanceId, emitRemote = true) {
        const connectedEnvs: string[] = Object.keys(this.options.connectedEnvironments);

        if (emitRemote && (this.readyEnvs.has(instanceId) || connectedEnvs.includes(instanceId))) {
            for (const env of [...this.readyEnvs, ...connectedEnvs]) {
                if (![instanceId, from, this.id].includes(env)) {
                    this.sendTo(env, {
                        type: 'dispose',
                        origin: instanceId,
                        from: this.id,
                        to: env,
                    });
                }
            }
        }
        this.locallyClear(instanceId);
    }

    public handleReady({ from }: { from: string }): void {
        this.readyEnvs.add(from);
        const pendingEnvCb = this.pendingEnvs.get(from);
        if (!pendingEnvCb) return;

        this.pendingEnvs.deleteKey(from);
        for (const callbackRecord of this.pendingCallbacks.values()) {
            if (callbackRecord.message.to === from) {
                callbackRecord.scheduleOnTimeout();
            }
        }
        const pendingMessages = this.pendingMessages.get(from);
        if (pendingMessages) {
            for (const postMessage of pendingMessages) {
                postMessage();
            }
            this.pendingMessages.deleteKey(from);
        }
        for (const cb of pendingEnvCb) {
            cb();
        }
    }

    private getHandlerId(envId: string, api: string, method: string): string {
        return `${this.id}__${envId}_${api}@${method}`;
    }

    private applyApiDirectives(id: string, api: APIService) {
        const serviceConfig = api[SERVICE_CONFIG];
        if (serviceConfig) {
            this.apisOverrides[id] = {};
            for (const methodName of Object.keys(serviceConfig)) {
                const config = serviceConfig[methodName]!(api);
                if (config.proxyFunction) {
                    this.apisOverrides[id][methodName] = config.proxyFunction;
                }
            }
        }
    }

    private getStatus() {
        return {
            rootEnvId: this.id,
            callbackIdPrefix: this.callbackIdPrefix,
            pendingEnvs: countValues(this.pendingEnvs),
            pendingMessages: countValues(this.pendingMessages),
            handlers: Array.from(this.handlers).reduce<Record<string, number>>((acc, [key, value]) => {
                acc[key] = value.size;
                return acc;
            }, {}),
            eventDispatchers: Object.keys(this.eventDispatchers),
            apis: Object.keys(this.apis),
            readyEnvs: Array.from(this.readyEnvs),
            environments: Object.entries(this.environments).reduce<Record<string, Record<string, string>>>(
                (acc, [key, value]) => {
                    const info: Record<string, string> = {};
                    try {
                        info.typeName = value.host.constructor.name;
                    } catch (e) {
                        info.typeName = String(e);
                    }
                    try {
                        info.name = value.host.name ?? 'unknown';
                    } catch (e) {
                        info.name = String(e);
                    }
                    acc[key] = info;
                    return acc;
                },
                {},
            ),
            pendingCallbacks: Array.from(this.pendingCallbacks.entries()).reduce(
                (acc, [key, value]) => {
                    acc[key] = {
                        to: value.message.to,
                        isTimeoutScheduled: value.timerId !== undefined,
                    };
                    return acc;
                },
                {} as Record<string, { to: string; isTimeoutScheduled: boolean }>,
            ),
        };
    }

    private handleStatusRequest({ callbackId, from }: StatusMessage) {
        this.sendTo(from, {
            type: 'callback',
            origin: this.id,
            from: this.id,
            to: from,
            callbackId,
            data: this.getStatus(),
        });
    }

    private autoRegisterEnvFromMessage(message: Message, source: Target) {
        const isKnownEnvironment = !!this.environments[message.from];
        const isKnownOrigin = !!this.environments[message.origin];

        if (!isKnownEnvironment || !isKnownOrigin) {
            if (source !== this.host) {
                this.log(
                    `Received message from unknown ${!isKnownEnvironment ? 'environment' : 'origin'} "${message.from}" at "${this.id}", auto-registering it`,
                    message,
                );
                this.registerEnv(!isKnownEnvironment ? message.from : message.origin, source);
            } else {
                // if we try to register the host itself, we will get stuck in an infinite loop
                // this happens when the host is a window and the message is from the same window
                this.log(`Skipping host self auto-registration at "${this.id}"`);
            }
        }
    }

    private locallyClear(instanceId: string) {
        this.readyEnvs.delete(instanceId);
        this.pendingMessages.deleteKey(instanceId);
        this.pendingEnvs.deleteKey(instanceId);
        delete this.environments[instanceId];
        for (const callbackRecord of this.pendingCallbacks.values()) {
            if (callbackRecord.message.to === instanceId) {
                callbackRecord.reject(new EnvironmentDisconnectedError(instanceId, this.id, callbackRecord.message));
            }
        }
        for (const dispose of this.disposeListeners) {
            dispose(instanceId);
        }
    }

    private forwardMessage(message: Message, env: EnvironmentRecord) {
        message.forwardingChain ??= [];
        // check before push
        const cycle = message.forwardingChain.includes(this.id);
        // push after check so we see the cycle in the forwardingChain
        message.forwardingChain.push(this.id);
        if (cycle) {
            this.sendTo(message.from, {
                type: 'callback',
                origin: this.id,
                from: this.id,
                to: message.origin,
                callbackId: message.callbackId,
                forwardingChain: message.forwardingChain,
                error: new CircularForwardingError(message, this.id, env.id),
            });
            return;
        } else {
            this.log(`Forwarding message from ${this.id} to ${env.id}`, message);
        }
        if (this.pendingEnvs.get(env.id)) {
            this.pendingMessages.add(env.id, () => this.post(this.resolveMessageTarget(env.id), message));
            return;
        }
        this.post(env.host, message);
    }

    private apiCall(origin: string, api: string, method: string, args: unknown[]): unknown {
        const apiOverride = this.apisOverrides[api]?.[method];

        if (!apiOverride) {
            return this.apis[api]![method]!(...args);
        }

        return apiOverride(...[origin, ...args]);
    }

    private addOrRemoveListener({
        envId,
        api,
        method,
        callbackId,
        origin,
        serviceComConfig,
        fn,
        resolve,
        reject,
    }: {
        envId: string;
        api: string;
        method: string;
        callbackId: string | undefined;
        origin: string;
        serviceComConfig: Record<string, AnyServiceMethodOptions>;
        fn: UnknownFunction;
        resolve: (value?: any) => void;
        reject: (reason: unknown) => void;
    }) {
        const removeListenerRef =
            serviceComConfig[method]?.removeAllListeners ?? serviceComConfig[method]?.removeListener;

        if (removeListenerRef) {
            const listenerHandlerId = this.getHandlerId(envId, api, removeListenerRef);
            const listenerHandlersBucket = this.handlers.get(listenerHandlerId);
            if (!listenerHandlersBucket) {
                resolve();
                return;
            }
            if (serviceComConfig[method]?.removeListener) {
                listenerHandlersBucket.delete(fn);
            } else {
                listenerHandlersBucket.clear();
            }
            if (listenerHandlersBucket.size === 0) {
                // send remove handler call
                // sometimes the callback will never happen since target environment is already dead
                this.sendTo(envId, {
                    type: 'unlisten',
                    from: this.id,
                    to: envId,
                    origin,
                    handlerId: listenerHandlerId,
                    data: {
                        api,
                        method,
                    },
                });
                resolve();
            } else {
                resolve();
            }
        } else {
            if (!serviceComConfig[method]?.listener) throw new UnConfiguredMethodError(api, method);

            const handlerId = this.getHandlerId(envId, api, method);
            const handlersBucket = this.handlers.get(handlerId);

            if (handlersBucket && handlersBucket.size !== 0) {
                if (handlersBucket.has(fn)) throw new DuplicateRegistrationError(handlerId, 'Listener');

                handlersBucket.add(fn);
                resolve();
            } else {
                this.callWithCallback({
                    envId,
                    message: {
                        type: 'listen',
                        from: this.id,
                        to: envId,
                        origin,
                        handlerId: this.createHandlerRecord(envId, api, method, fn),
                        callbackId,
                        data: {
                            api,
                            method,
                        },
                    },
                    callbackId,
                    resolve,
                    reject,
                });
            }
        }
    }

    private callWithCallback<T extends Message['type']>({
        envId,
        message,
        callbackId,
        resolve,
        reject,
    }: {
        envId: string;
        message: Extract<Message, { type: T }>;
        callbackId: string | undefined;
        resolve: (value?: any) => void;
        reject: (reason: unknown) => void;
    }) {
        if (callbackId) {
            this.registerCallbackRecord(message, callbackId, resolve, reject);
        }

        this.sendTo(envId, message);

        if (!callbackId) {
            resolve();
        }
    }

    private sendTo<T extends Message['type']>(envId: string, message: Extract<Message, { type: T }>) {
        if (this.pendingEnvs.get(envId)) {
            this.pendingMessages.add(envId, () => this.post(this.resolveMessageTarget(envId), message));
        } else {
            this.post(this.resolveMessageTarget(envId), message);
        }
    }

    private post<T extends Message['type']>(target: Target, message: Extract<Message, { type: T }>) {
        if (isWorkerContext(target)) {
            target.postMessage(message);
        } else {
            target.postMessage(message, '*');
        }
    }

    private resolveMessageTarget(envId: string): Target {
        const env = this.environments[envId] ?? this.environments[this.id];
        if (!env) return HOST_REMOVED;
        if (env.id !== this.id) return env.host;
        if (env.host instanceof BaseHost) return env.host.parent ?? env.host;
        return getPostEndpoint(env.host);
    }

    private handleEvent({ data, handlerId }: EventMessage) {
        const handlers = this.handlers.get(handlerId);
        if (!handlers) return;

        for (const handler of handlers) {
            handler(...data);
        }
    }

    private async handleUnListen({ callbackId, data: { method, api }, from, handlerId, origin }: UnListenMessage) {
        const namespacedHandlerId = handlerId + origin;
        const dispatcher = this.eventDispatchers[namespacedHandlerId];
        if (!dispatcher) return;

        delete this.eventDispatchers[namespacedHandlerId];

        const data = await this.apiCall(origin, api, method, [dispatcher]);

        if (!callbackId) return;

        this.sendTo(from, {
            type: 'callback',
            origin: this.id,
            from: this.id,
            to: from,
            callbackId,
            data,
        });
    }

    private handleDispose({ from, origin }: DisposeMessage) {
        if (from === this.id) return;

        this.clearEnvironment(origin, from);
    }

    private async handleListen(message: ListenMessage) {
        const {
            handlerId,
            origin,
            callbackId,
            from,
            data: { api, method },
        } = message;

        try {
            const namespacedHandlerId = handlerId + origin;
            const dispatcher = this.eventDispatchers[namespacedHandlerId] ?? this.createDispatcher(from, message);
            const data = await this.apiCall(origin, api, method, [dispatcher]);

            if (!callbackId) return;

            this.sendTo(from, {
                type: 'callback',
                origin: this.id,
                from: this.id,
                to: from,
                callbackId,
                data,
            });
        } catch (error) {
            this.sendTo(from, {
                type: 'callback',
                origin: this.id,
                from: this.id,
                to: from,
                callbackId,
                error: errorToJson(error),
            });
        }
    }

    private async handleCall({ callbackId, data, from, origin }: CallMessage) {
        try {
            const { args, api, method } = data;
            const deserializedArgs = deserializeApiCallArguments(args);
            const apiCallReturnData = await this.apiCall(origin, api, method, deserializedArgs);

            if (!callbackId) return;

            this.sendTo(from, {
                type: 'callback',
                origin: this.id,
                from: this.id,
                to: origin,
                callbackId,
                data: apiCallReturnData,
                DEBUG_CALL_INFO: Communication.DEBUG ? data : undefined,
            });
        } catch (error) {
            this.sendTo(from, {
                type: 'callback',
                origin: this.id,
                from: this.id,
                to: from,
                callbackId,
                error: errorToJson(error),
            });
        }
    }

    private handleCallback(message: CallbackMessage) {
        if (!message.callbackId) return;

        const callback = this.pendingCallbacks.get(message.callbackId);
        if (!callback) throw new UnknownCallbackIdError(message, this.id);

        if (message.error) {
            // If the error is not caught later, and logged to the console,
            // it would be nice to indicate which environment the error came from.
            // We shouldn't change the error message or the error name because
            // those could be used by error-handling code. Fortunately, we can
            // add metadata to the stack trace, and Chrome logs the entire stack
            // property to the console. Unfortunately, Firefox doesn't.
            const error = Object.assign(new Error(), message.error);
            error.stack = `Remote call failed in "${message.from}" ${error.stack ? `\n${error.stack}` : ''}`;
            callback.reject(error);
        }

        callback.resolve(message.data);
    }

    private createDispatcher(envId: string, { handlerId, origin }: ListenMessage): SerializableMethod {
        return (this.eventDispatchers[handlerId + origin] = (...args) =>
            this.sendTo(envId, {
                type: 'event',
                origin: this.id,
                from: this.id,
                to: envId,
                handlerId: handlerId,
                data: args,
            }));
    }

    private createHandlerRecord(envId: string, api: string, method: string, fn: UnknownFunction): string {
        const handlerId = this.getHandlerId(envId, api, method);
        const handlersBucket = this.handlers.get(handlerId);

        if (handlersBucket) {
            handlersBucket.add(fn);
        } else {
            this.handlers.set(handlerId, new Set([fn]));
            this.subscribeToEnvironmentDispose((disposedEnvId) => {
                if (envId === disposedEnvId) {
                    this.handlers.delete(handlerId);
                }
            });
        }

        return handlerId;
    }

    private registerCallbackRecord(
        message: Message,
        callbackId: string,
        resolve: (value: unknown) => void,
        reject: (reason: unknown) => void,
    ) {
        if (this.disposing) return;

        const callbackItem: CallbackRecord<any> = {
            timerId: undefined,
            message,
            resolve: (value: unknown) => {
                this.pendingCallbacks.delete(callbackId);
                clearTimeout(callbackItem.timerId);
                resolve(value);
            },
            reject: (error: Error) => {
                this.pendingCallbacks.delete(callbackId);
                clearTimeout(callbackItem.timerId);
                if (Communication.DEBUG) {
                    error.cause = redactArguments(message);
                }
                reject(error);
            },
            scheduleOnSlow: () => {
                setTimeout(() => {
                    if (this.pendingCallbacks.has(callbackId)) {
                        console.warn(new CallbackTimeoutError(callbackId, this.id, message).message);
                    }
                }, this.slowThreshold);
            },
            scheduleOnTimeout: () => {
                callbackItem.timerId = setTimeout(
                    () => callbackItem.reject(new CallbackTimeoutError(callbackId, this.id, message)),
                    this.callbackTimeout,
                );
            },
        };
        if (!this.pendingEnvs.hasKey(message.to)) {
            if (this.options.warnOnSlow) {
                callbackItem.scheduleOnSlow();
            }
            callbackItem.scheduleOnTimeout();
        }
        this.pendingCallbacks.set(callbackId, callbackItem);
    }

    /**
     * Logs a message to the console if the DEBUG flag is set.
     *
     * @param description - The description of the log message.
     * @param message - The message to quote (display JSON.stringify version with 2 spaces indentation).
     */
    private log(description: string, message?: Message) {
        if (Communication.DEBUG) {
            console.debug(`[DEBUG] ${description}.`);
            message && console.debug({ message });
        }
    }
}
