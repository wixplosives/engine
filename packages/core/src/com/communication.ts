import {
    CALLBACK_TIMEOUT,
    DUPLICATE_REGISTER,
    ENV_DISCONNECTED,
    REMOTE_CALL_FAILED,
    reportError,
    UNKNOWN_CALLBACK_ID,
} from './errors';
import { isWindow, isWorkerContext, MultiCounter } from './helpers';
import type {
    CallbackMessage,
    CallMessage,
    EventMessage,
    ListenMessage,
    UnListenMessage,
    Message,
    ReadyMessage,
} from './message-types';
import type {
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
    AnyServiceMethodOptions,
    ServiceComConfig,
} from './types';

import { SERVICE_CONFIG } from '../symbols';

import { serializeError } from '../helpers';
import { SetMultiMap } from '@wixc3/patterns';
import type { Environment, SingleEndpointContextualEnvironment, EnvironmentMode } from '../entities/env';
import type { IDTag } from '../types';
import { BaseHost } from './hosts/base-host';
import { WsClientHost } from './hosts/ws-client-host';
import { isMessage } from './message-types';
import { deferred } from 'promise-assist';

export interface ConfigEnvironmentRecord extends EnvironmentRecord {
    registerMessageHandler?: boolean;
}

export interface CommunicationOptions {
    warnOnSlow?: boolean;
    publicPath?: string;
    connectedEnvironments?: { [environmentId: string]: ConfigEnvironmentRecord };
}

/**
 * Manages all API registrations and message forwarding
 * in each execution context.
 */
export class Communication {
    private rootEnvId: string;
    private rootEnvName: string;
    private idsCounter = new MultiCounter();
    private disposing = false;
    private readonly callbackTimeout = 60_000 * 5; // 5 minutes
    private readonly slowThreshold = 5_000; // 5 seconds
    private callbacks: { [callbackId: string]: CallbackRecord<unknown> } = {};
    private pendingEnvs: SetMultiMap<string, UnknownFunction> = new SetMultiMap();
    private pendingMessages = new SetMultiMap<string, UnknownFunction>();
    private handlers = new Map<string, Set<UnknownFunction>>();
    private eventDispatchers: { [dispatcherId: string]: SerializableMethod } = {};
    private apis: RemoteAPIServicesMapping = {};
    private apisOverrides: RemoteAPIServicesMapping = {};
    private options: Required<CommunicationOptions>;
    private readyEnvs = new Set<string>();
    private environments: { [environmentId: string]: EnvironmentRecord } = {};
    private messageHandlers = new WeakMap<Target, (options: { data: null | Message }) => void>();
    private disposeListeners = new Set<(envId: string) => void>();
    private callbackToEnvMapping = new Map<string, string>();

    constructor(
        host: Target,
        id: string,
        public topology: Record<string, string> = {},
        public resolvedContexts: Record<string, string> = {},
        public isServer = false,
        options?: CommunicationOptions
    ) {
        this.options = { warnOnSlow: false, publicPath: '', connectedEnvironments: {}, ...options };
        this.rootEnvId = id;
        this.rootEnvName = id.split('/')[0]!;
        this.registerMessageHandler(host);
        this.registerEnv(id, host);
        this.environments['*'] = { id, host };

        this.post(this.getPostEndpoint(host), {
            type: 'ready',
            from: id,
            to: '*',
            origin: id,
            forwardingChain: [],
        });

        for (const [id, envEntry] of Object.entries(this.options.connectedEnvironments)) {
            if (envEntry.registerMessageHandler) {
                this.registerMessageHandler(envEntry.host);
            }
            this.environments[id] = envEntry;
        }
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

    public getEnvironmentContext(endPoint: SingleEndpointContextualEnvironment<string, Environment[]>) {
        return this.resolvedContexts[endPoint.env];
    }

    public getEnvironmentInstanceId(envName: string, endpointType: EnvironmentMode) {
        return endpointType === 'single' ? envName : this.generateEnvInstanceID(envName);
    }

    public getPublicPath() {
        return this.options.publicPath;
    }

    public setTopology(envName: string, envUrl: string) {
        this.topology[envName] = envUrl;
    }

    public subscribeToEnvironmentDispose(handler: (envId: string) => void) {
        this.disposeListeners.add(handler);
    }
    public unsubscribeToEnvironmentDispose(handler: (envId: string) => void) {
        this.disposeListeners.delete(handler);
    }

    /**
     * Creates a Proxy for a remote service api.
     */
    public apiProxy<T extends object>(
        instanceToken: EnvironmentInstanceToken | Promise<EnvironmentInstanceToken>,
        { id: api }: IDTag,
        serviceComConfig: ServiceComConfig<T> = {}
    ): AsyncApi<T> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return new Proxy(Object.create(null), {
            get: (obj, method) => {
                if (typeof method === 'string') {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    let runtimeMethod = obj[method];
                    if (!runtimeMethod) {
                        runtimeMethod = async (...args: unknown[]) =>
                            this.callMethod(
                                (await instanceToken).id,
                                api,
                                method,
                                args,
                                this.rootEnvId,
                                serviceComConfig as Record<string, AnyServiceMethodOptions>,
                                []
                            );
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        obj[method] = runtimeMethod;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
        const onTargetMessage = ({ data }: { data: null | Message }) => {
            if (isMessage(data)) {
                if (!this.environments[data.from]) {
                    this.registerEnv(data.from, envTarget);
                }
                if (!this.environments[data.origin]) {
                    this.registerEnv(data.origin, envTarget);
                }
                this.handleEvent({ data });
            }
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
        serviceComConfig: Record<string, AnyServiceMethodOptions>,
        forwardingChain: string[]
    ): Promise<unknown> {
        return new Promise<void>((res, rej) => {
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
                    forwardingChain,
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
                    origin,
                    forwardingChain,
                };
                this.callWithCallback(envId, message, callbackId, res, rej);
            }
        });
    }
    /**
     * handles Communication incoming message.
     */
    public async handleMessage(message: Message): Promise<void> {
        if (message.type === 'dispose' && message.to === '*') {
            this.clearEnvironment(message.origin, this.rootEnvId);
            return;
        }
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
            case 'dispose':
                if (message.from !== this.rootEnvId) {
                    this.clearEnvironment(message.origin, message.from);
                }
                break;
            default:
                break;
        }
    }

    /**
     * Dispose the Communication and stop listening to messages.
     */
    public dispose(): void {
        this.disposing = true;
        for (const { host, id } of Object.values(this.environments)) {
            if (host instanceof WsClientHost) {
                host.subscribers.clear();
                host.dispose();
            }
            this.removeMessageHandler(host);
            this.locallyClear(id);
        }

        this.locallyClear(this.rootEnvId);
        this.disposeListeners.clear();

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

    public getEnvironmentHost(envName: string) {
        return this.environments[envName]?.host;
    }

    /**
     * Gets a list of all registered environment instance ids.
     * @returns the list of instance ids.
     */
    public getRegisteredEnvironmentInstances(): string[] {
        return Object.keys(this.environments).filter((id) => id !== '*');
    }

    private parseHandlerId(handlerId: string, prelude: string) {
        const [api, method] = handlerId.slice(prelude.length).split('@') as [string, string];
        return {
            api,
            method,
        };
    }

    private reconnectHandler(instanceId: string, handlerId: string) {
        return new Promise((res, rej) => {
            const message: ListenMessage = {
                to: instanceId,
                from: this.rootEnvId,
                type: 'listen',
                data: this.parseHandlerId(
                    handlerId,
                    this.createHandlerIdPrefix({ from: this.rootEnvId, to: instanceId })
                ),
                callbackId: this.idsCounter.next('c'),
                origin: this.rootEnvId,
                handlerId,
                forwardingChain: [],
            };
            this.createCallbackRecord(message, message.callbackId!, res, rej);
            this.sendTo(instanceId, message);
        });
    }

    public async reconnectHandlers(instanceId: string) {
        const handlerPrefix = this.createHandlerIdPrefix({ from: this.rootEnvId, to: instanceId });

        for (const handlerId of this.handlers.keys()) {
            if (handlerId.startsWith(handlerPrefix)) {
                await this.reconnectHandler(instanceId, handlerId);
            }
        }
    }

    private createHandlerIdPrefix({ from, to }: { from: string; to: string }) {
        return `${from}__${to}_`;
    }

    private applyApiDirectives(id: string, api: APIService): void {
        const serviceConfig = api[SERVICE_CONFIG];
        if (serviceConfig) {
            this.apisOverrides[id] = {};
            for (const methodName of Object.keys(serviceConfig)) {
                const config = serviceConfig[methodName]!(api);
                if (config.proxyFunction) {
                    this.apisOverrides[id]![methodName] = config.proxyFunction;
                }
            }
        }
    }

    public envReady(instanceId: string): Promise<void> {
        const { promise, resolve } = deferred();
        if (this.readyEnvs.has(instanceId)) {
            this.handleReady({ from: instanceId } as ReadyMessage);
            resolve();
        } else {
            this.pendingEnvs.add(instanceId, () => resolve());
        }

        return promise;
    }

    public clearEnvironment(instanceId: string, from: string = instanceId, emitRemote = true) {
        const connectedEnvs: string[] = Object.keys(this.options.connectedEnvironments);
        if (emitRemote && (this.readyEnvs.has(instanceId) || connectedEnvs.includes(instanceId))) {
            for (const env of [...this.readyEnvs, ...connectedEnvs]) {
                if (![instanceId, from, this.rootEnvId].includes(env)) {
                    this.sendTo(env, {
                        type: 'dispose',
                        from: this.rootEnvId,
                        to: env,
                        origin: instanceId,
                        forwardingChain: [],
                    });
                }
            }
        }
        this.locallyClear(instanceId);
    }

    private locallyClear(instanceId: string) {
        this.readyEnvs.delete(instanceId);
        this.pendingMessages.deleteKey(instanceId);
        this.pendingEnvs.deleteKey(instanceId);
        delete this.environments[instanceId];
        for (const [callbackId, env] of this.callbackToEnvMapping.entries() ?? []) {
            if (env === instanceId && this.callbacks[callbackId]) {
                const { timerId, reject } = this.callbacks[callbackId]!;
                clearTimeout(timerId);
                reject(new Error(ENV_DISCONNECTED(instanceId)));
                delete this.callbacks[callbackId];
                this.callbackToEnvMapping.delete(callbackId);
            }
        }
        for (const dispose of this.disposeListeners) {
            dispose(instanceId);
        }
    }

    private async forwardMessage(message: Message, env: EnvironmentRecord): Promise<void> {
        const responseMessage: Message = {
            from: message.to,
            to: message.from,
            callbackId: message.callbackId,
            origin: message.to,
            type: 'callback',
            forwardingChain: [this.rootEnvId],
        };

        if (message.forwardingChain.indexOf(this.rootEnvId) > -1) {
            this.sendTo(message.from, {
                ...responseMessage,
                error: new Error(
                    `cannot reach environment '${message.to}' from '${message.from}' since it's stuck in circular messaging loop`
                ),
            });
            return;
        }

        message.forwardingChain = [...message.forwardingChain, this.rootEnvId];

        if (message.type === 'call') {
            try {
                const data = await this.callMethod(
                    env.id,
                    message.data.api,
                    message.data.method,
                    message.data.args,
                    message.origin,
                    {},
                    message.forwardingChain
                );

                if (message.callbackId) {
                    this.sendTo(message.from, { ...responseMessage, data });
                }
            } catch (error) {
                if (message.callbackId) {
                    this.sendTo(message.from, { ...responseMessage, error: serializeError(error) });
                }
            }
        } else if (message.type === 'callback' || message.type === 'dispose') {
            if (message.type === 'callback' && message.callbackId) {
                if (this.callbacks[message.callbackId]) {
                    const { resolve, timerId } = this.callbacks[message.callbackId]!;
                    resolve(message.data);
                    clearTimeout(timerId);
                } else {
                    this.sendTo(message.to, message);
                }
            } else {
                this.sendTo(message.to, message);
            }
        } else if (message.type === 'unlisten') {
            await this.forwardUnlisten(message);
        } else if (message.type === 'listen') {
            await this.forwardListenMessage(message);
        }
    }

    private async forwardListenMessage(message: ListenMessage): Promise<void> {
        const callbackId = this.idsCounter.next('c');

        const data = await new Promise<void>((res, rej) => {
            const handlerId = message.handlerId;
            const handler = (...args: SerializableArguments) => {
                this.sendTo(message.from, {
                    to: message.from,
                    from: message.to,
                    type: 'event',
                    data: args,
                    handlerId,
                    origin: message.from,
                    forwardingChain: [],
                });
            };
            this.eventDispatchers[handlerId] = handler;

            this.addOrRemoveListener(
                message.to,
                message.data.api,
                message.data.method,
                callbackId,
                message.origin,
                { [message.data.method]: { listener: true } },
                handler,
                message.forwardingChain,
                res,
                rej
            );
        });

        const replyCallback: Message = {
            to: message.from,
            type: 'callback',
            callbackId: message.callbackId,
            from: message.to,
            origin: message.origin,
            data,
            forwardingChain: [],
        };

        this.sendTo(message.from, replyCallback);
    }

    private apiCall(origin: string, api: string, method: string, args: unknown[]): unknown {
        if (this.apisOverrides[api]?.[method]) {
            return this.apisOverrides[api]![method]!(...[origin, ...args]);
        }
        return this.apis[api]![method]!(...args);
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
        forwardingChain: string[],
        res: () => void,
        rej: () => void
    ) {
        const removeListenerRef =
            serviceComConfig[method]?.removeAllListeners || serviceComConfig[method]?.removeListener;

        if (removeListenerRef) {
            const listenerHandlerId = this.getHandlerId(envId, api, removeListenerRef);
            const listenerHandlersBucket = this.handlers.get(listenerHandlerId);
            if (!listenerHandlersBucket) {
                res();
                return;
            }
            if (serviceComConfig[method]?.removeListener) {
                listenerHandlersBucket.delete(fn);
            } else {
                listenerHandlersBucket.clear();
            }
            if (listenerHandlersBucket.size === 0) {
                // send remove handler call
                const message: UnListenMessage = {
                    to: envId,
                    from: this.rootEnvId,
                    type: 'unlisten',
                    data: {
                        api,
                        method,
                    },
                    handlerId: listenerHandlerId,
                    origin,
                    forwardingChain,
                };
                // sometimes the callback will never happen since target environment is already dead
                this.sendTo(envId, message);
                res();
            } else {
                res();
            }
        } else {
            if (serviceComConfig[method]?.listener) {
                const handlersBucket = this.handlers.get(this.getHandlerId(envId, api, method));

                if (handlersBucket && handlersBucket.size !== 0) {
                    if (handlersBucket.has(fn)) {
                        throw new Error(
                            'Cannot add same listener instance twice ' + this.getHandlerId(envId, api, method)
                        );
                    }
                    handlersBucket.add(fn);
                    res();
                } else {
                    const message: ListenMessage = {
                        to: envId,
                        from: this.rootEnvId,
                        type: 'listen',
                        data: {
                            api,
                            method,
                        },
                        handlerId: this.createHandlerRecord(envId, api, method, fn),
                        callbackId,
                        origin,
                        forwardingChain,
                    };

                    this.callWithCallback(envId, message, callbackId, res, rej);
                }
            } else {
                throw new Error(`cannot add listener to unconfigured method ${api} ${method}`);
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
        if (callbackId) {
            this.createCallbackRecord(message, callbackId, res, rej);
        }

        this.sendTo(envId, message);

        if (!callbackId) {
            res();
        }
    }
    private sendTo(envId: string, message: Message): void {
        if (this.pendingEnvs.get(envId)) {
            this.pendingMessages.add(envId, () => this.post(this.resolveMessageTarget(envId), message));
        } else {
            this.post(this.resolveMessageTarget(envId), message);
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
        let env = this.environments[envId]!;
        if (env && env.id !== this.rootEnvId) {
            return env.host;
        } else {
            if (!env) {
                env = this.environments[this.rootEnvId]!;
            }
            const target = env.host;
            if (target instanceof BaseHost) {
                return target.parent || target;
            }
            return this.getPostEndpoint(target);
        }
    }

    private getPostEndpoint(target: Target): Window | Worker {
        return isWindow(target) ? (target.opener as Window) || target.parent : (target as Worker);
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

    public handleReady({ from }: ReadyMessage): void {
        this.readyEnvs.add(from);
        const pendingEnvCb = this.pendingEnvs.get(from);
        if (pendingEnvCb) {
            this.pendingEnvs.deleteKey(from);
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
    }
    private async handleUnListen(message: UnListenMessage) {
        const namespacedHandlerId = message.handlerId + message.origin;
        const dispatcher = this.eventDispatchers[namespacedHandlerId];
        if (dispatcher) {
            delete this.eventDispatchers[namespacedHandlerId];
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, [dispatcher]);
            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.from,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId,
                    forwardingChain: [],
                });
            }
        }
    }

    private async forwardUnlisten(message: UnListenMessage) {
        const callbackId = this.idsCounter.next('c');
        const { method, api } = this.parseHandlerId(message.handlerId, this.createHandlerIdPrefix(message));

        const data = await new Promise<void>((res, rej) =>
            this.addOrRemoveListener(
                message.to,
                api,
                message.data.method,
                callbackId,
                message.origin,
                {
                    [message.data.method]: {
                        removeListener: method,
                    },
                },
                this.eventDispatchers[message.handlerId]!,
                message.forwardingChain,
                res,
                rej
            )
        );

        delete this.eventDispatchers[message.handlerId];
        if (message.callbackId) {
            this.sendTo(message.from, {
                to: message.from,
                from: message.to,
                type: 'callback',
                data,
                callbackId: message.callbackId,
                origin: message.to,
                forwardingChain: [],
            });
        }
    }

    private async handleListen(message: ListenMessage): Promise<void> {
        try {
            const namespacedHandlerId = message.handlerId + message.origin;

            const dispatcher =
                this.eventDispatchers[namespacedHandlerId] || this.createDispatcher(message.from, message);
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, [dispatcher]);

            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.from,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId,
                    forwardingChain: [],
                });
            }
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: serializeError(error),
                callbackId: message.callbackId,
                origin: this.rootEnvId,
                forwardingChain: [],
            });
        }
    }

    private async handleCall(message: CallMessage): Promise<void> {
        try {
            const data = await this.apiCall(message.origin, message.data.api, message.data.method, message.data.args);
            if (message.callbackId) {
                this.sendTo(message.from, {
                    to: message.origin,
                    from: this.rootEnvId,
                    type: 'callback',
                    data,
                    callbackId: message.callbackId,
                    origin: this.rootEnvId,
                    forwardingChain: [],
                });
            }
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: serializeError(error),
                callbackId: message.callbackId,
                origin: this.rootEnvId,
                forwardingChain: [],
            });
        }
    }

    private handleCallback(message: CallbackMessage): void {
        const rec = message.callbackId ? this.callbacks[message.callbackId] : null;
        if (rec && message.error) {
            // If the error is not caught later, and logged to the console,
            // it would be nice to indicate which environment the error came from.
            // We shouldn't change the error message or the error name because
            // those could be used by error-handling code. Fortunately, we can
            // add metadata to the stack trace, and Chrome logs the entire stack
            // property to the console. Unfortunately, Firefox doesn't.
            const error = Object.assign(new Error(), message.error);
            error.stack = REMOTE_CALL_FAILED(message.from, error.stack);
            rec.reject(error);
        } else if (rec) {
            rec.resolve(message.data);
        } else {
            // TODO: only in dev mode
            if (message.callbackId) {
                throw new Error(UNKNOWN_CALLBACK_ID(removeMessageArgs(message)));
            }
        }
    }

    private createDispatcher(envId: string, message: ListenMessage): SerializableMethod {
        const namespacedHandlerId = message.handlerId + message.origin;

        return (this.eventDispatchers[namespacedHandlerId] = (...args: SerializableArguments) => {
            this.sendTo(envId, {
                to: envId,
                from: this.rootEnvId,
                type: 'event',
                data: args,
                handlerId: message.handlerId,
                origin: this.rootEnvId,
                forwardingChain: [],
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
        return `${this.createHandlerIdPrefix({ from: this.rootEnvId, to: envId })}${api}@${method}`;
    }
    private createHandlerRecord(envId: string, api: string, method: string, fn: UnknownFunction): string {
        const handlerId = this.getHandlerId(envId, api, method);
        const handlersBucket = this.handlers.get(handlerId);
        if (!handlersBucket) {
            this.subscribeToEnvironmentDispose((disposedEnvId) => {
                if (envId === disposedEnvId) {
                    this.handlers.delete(handlerId);
                }
            });
        }
        handlersBucket ? handlersBucket.add(fn) : this.handlers.set(handlerId, new Set([fn]));
        return handlerId;
    }
    private createCallbackRecord(
        message: Message,
        callbackId: string,
        res: (value: unknown) => void,
        rej: (reason: Error) => void
    ) {
        if (!this.disposing) {
            this.callbackToEnvMapping.set(callbackId, message.to);
            const resolve = (value: unknown) => {
                this.callbackToEnvMapping.delete(callbackId);
                delete this.callbacks[callbackId];
                clearTimeout(timerId);
                res(value);
            };
            const reject = (error: Error) => {
                this.callbackToEnvMapping.delete(callbackId);
                delete this.callbacks[callbackId];
                clearTimeout(timerId);
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
                reject,
            };
        }
    }
}

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
        ...(removeAll ? { [removeAll]: { removeAllListeners: onMethod } } : undefined),
    };
}
