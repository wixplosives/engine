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
import { CallbackMessage, CallMessage, EventMessage, ListenMessage, Message, ReadyMessage } from './message-types';
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
    WindowHost
} from './types';

import { SERVICE_CONFIG } from '../symbols';

import { SetMultiMap } from '@file-services/utils';
import { EndpointType, Environment, NodeEnvironment, SingleEndpointContextualEnvironment } from '../entities/env';
import { IDTag } from '../types';
import { BaseHost } from './base-host';
import { WsClientHost } from './ws-client-host';

export interface ICommunicationOptions {
    warnOnSlow?: boolean;
}

/**
 * Main class that manage all api registration and message forwarding in each execution context.
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
        this.options = { warnOnSlow: false, ...options };
        this.rootEnvId = id;
        this.rootEnvName = id.split('/')[0];
        this.registerMessageHandler(host);
        this.registerEnv(id, host);
        this.environments['*'] = { id, host };

        this.post(this.getPostEndpoint(host), { type: 'ready', from: id, to: '*' });
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
    public registerAPI<T>({ id }: IDTag<string>, api: T): T {
        if (!this.apis[id]) {
            this.apis[id] = api;
            this.mapAPIMultiTenantFunctions(id, api);
            return api;
        } else {
            throw new Error(DUPLICATE_REGISTER(id, 'RemoteService'));
        }
    }

    public async spawnOrConnect(endPoint: SingleEndpointContextualEnvironment<string, Environment[]>) {
        const runtimeEnvironmentName = this.resolvedContexts[endPoint.env];

        const activeEnvironment = endPoint.environments.find(env => env.env === runtimeEnvironmentName)!;
        activeEnvironment.env = endPoint.env;

        return activeEnvironment!.envType === 'node'
            ? this.connect(activeEnvironment as NodeEnvironment<string>)
            : this.spawn(activeEnvironment);
    }

    public getEnvironmentContext(endPoint: SingleEndpointContextualEnvironment<string, Environment[]>) {
        return this.resolvedContexts[endPoint.env];
    }

    public async spawn(endPoint: Environment<string, EndpointType>, host?: WindowHost) {
        const { endpointType, env, envType } = endPoint;

        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : this.generateEnvInstanceID(env);

        await (envType === 'worker'
            ? this.useWorker(defaultWorkerFactory(env, instanceId, this.topology.publicPath), instanceId)
            : this.useWindow(host!, instanceId, defaultSourceFactory(env, instanceId, this.topology.publicPath)));

        return {
            id: instanceId
        };
    }
    /**
     * Connects to a remote NodeEnvironment
     */
    public async connect(endPoint: NodeEnvironment<string>) {
        const { env, envType } = endPoint;

        const url = this.topology[env];

        if (!url) {
            throw new Error(`Could not find ${envType} topology for ${env}`);
        }

        const instanceId = env;
        const host = new WsClientHost(url);

        this.registerMessageHandler(host);
        this.registerEnv(instanceId, host);
        // this.pendingEnvs.set(instanceId, ()=>{})
        await host.connected;
        // this.pendingEnvs.delete(instanceId)

        return {
            id: instanceId
        };
    }
    /**
     * Creates a Proxy for a remote service api.
     */
    public apiProxy<T>(
        instanceToken: EnvironmentInstanceToken | Promise<EnvironmentInstanceToken>,
        { id: serviceId }: IDTag<any>
    ): AsyncApi<T> {
        return new Proxy(Object.create(null), {
            get: (obj, methodName) => {
                if (typeof methodName === 'string') {
                    let method = obj[methodName];
                    if (!method) {
                        method = async (...args: unknown[]) =>
                            this.callMethod((await instanceToken).id, serviceId, methodName, args);
                        obj[methodName] = method;
                    }
                    return method;
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
    public callMethod(envId: string, apiId: string, methodName: string, args: SerializableArguments): Promise<unknown> {
        return new Promise((res, rej) => {
            if (this.isListenCall(args)) {
                const message: ListenMessage = {
                    to: envId,
                    from: this.rootEnvId,
                    type: 'listen',
                    data: this.createHandlerRecord(envId, apiId, methodName, args[0] as UnknownFunction),
                    callbackId: this.idsCounter.next('c')
                };
                this.createCallbackRecord(message, message.callbackId!, res, rej);
                this.sendTo(envId, message);
            } else {
                const message: CallMessage = {
                    to: envId,
                    from: this.rootEnvId,
                    type: 'call',
                    data: { api: apiId, method: methodName, args },
                    callbackId: this.idsCounter.next('c')
                };
                this.createCallbackRecord(message, message.callbackId!, res, rej);
                this.sendTo(envId, message);
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
        try {
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
                case 'ready':
                    await this.handleReady(message);
                    break;
                default:
                    break;
            }
        } catch (e) {
            throw e;
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
            host.removeEventListener('message', this.handleEvent, true);
        }
    }

    public getEnvironmentId() {
        return this.rootEnvId;
    }

    public getEnvironmentName() {
        return this.rootEnvName;
    }

    private mapAPIMultiTenantFunctions(id: string, api: APIService): void {
        const serviceConfig = api[SERVICE_CONFIG];
        if (serviceConfig) {
            this.apisOverrides[id] = {};
            for (const methodName of Object.keys(serviceConfig)) {
                this.apisOverrides[id][methodName] = (serviceConfig[methodName](api) as any).proxyFunction;
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
            this.sendTo(message.from, {
                from: message.to,
                type: 'callback',
                to: message.from,
                data: await this.callMethod(env.id, message.data.api, message.data.method, message.data.args),
                callbackId: message.callbackId
            });
        } else {
            throw new Error(MISSING_FORWARD_FOR_MESSAGE(message));
        }
    }
    private apiCall(from: string, api: string, method: string, args: unknown[]): unknown {
        if (this.apisOverrides[api] && this.apisOverrides[api][method]) {
            return (this.apisOverrides[api][method] as any)(...[from, ...args]);
        }
        return (this.apis[api][method] as any)(...args);
    }

    private unhandledMessage(_message: Message): void {
        // console.warn(
        //   `unhandledMessage at ${this.rootEnv} message:\n${JSON.stringify(message, null, 2)}`
        // )
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

    private async handleListen(message: ListenMessage): Promise<void> {
        try {
            if (this.eventDispatchers[message.data.handlerId]) {
                return;
            }
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                data: await this.apiCall(message.from, message.data.api, message.data.method, [
                    this.createDispatcher(message.from, message)
                ]),
                callbackId: message.callbackId
            });
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: String(error),
                callbackId: message.callbackId
            });
        }
    }
    private async handleCall(message: CallMessage): Promise<void> {
        try {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                data: await this.apiCall(message.from, message.data.api, message.data.method, message.data.args),
                callbackId: message.callbackId
            });
        } catch (error) {
            this.sendTo(message.from, {
                to: message.from,
                from: this.rootEnvId,
                type: 'callback',
                error: String(error),
                callbackId: message.callbackId
            });
        }
    }
    private handleCallback(message: CallbackMessage): void {
        const rec = message.callbackId ? this.callbacks[message.callbackId] : null;
        if (rec) {
            message.error ? rec.reject(new Error(REMOTE_CALL_FAILED(message))) : rec.resolve(message.data);
        } else {
            // TODO: only in dev mode
            throw new Error(UNKNOWN_CALLBACK_ID(removeMessageArgs(message)));
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
                handlerId: message.data.handlerId
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
    private createHandlerRecord(
        envId: string,
        api: string,
        method: string,
        fn: UnknownFunction
    ): ListenMessage['data'] {
        const handlerId = `${this.rootEnvId}__${envId}_${api}_${method}`;
        const handlersBucket = this.handlers.get(handlerId);
        handlersBucket ? handlersBucket.push(fn) : this.handlers.set(handlerId, [fn]);
        return {
            api,
            method,
            handlerId
        };
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
                    // tslint:disable-next-line: no-console
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
const defaultWorkerFactory = (envName: string, instanceId: string, publicPath: string = '/') => {
    return new Worker(`${publicPath}${envName}.webworker.js${location.search}`, { name: instanceId });
};

const defaultSourceFactory = (envName: string, _instanceId: string, publicPath: string = '/') => {
    return `${publicPath}${envName}.web.js${location.search}`;
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
