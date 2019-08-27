import { entityID, RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, IDENTIFY_API, REGISTER_VALUE } from '../symbols';
import { EnvVisibility } from '../types';
import { AllEnvironments, Environment } from './env';
import { FeatureInput } from './input';
type MergeConfigHook<T extends object> = (a: Readonly<T>, b: Readonly<Partial<T>>) => T;

export class Dispatcher<T>{
    private listeners: Set<Listener<T>> = new Set();
    public subscribe(listener: Listener<T>) {
        this.listeners.add(listener);
    }
    public unsubscribe(listener: Listener<T>) {
        this.listeners.delete(listener);
    }
    protected dispatch(t: T) {
        for (const listener of this.listeners) {
            listener(t);
        }
    }
}
export interface SerializedConfig { [key: string]: any; }

export class RegistryWriter extends Dispatcher<SerializedConfig>{
    constructor(private value: SerializedConfig = {}) {
        super();
    }

    public update(value: SerializedConfig) {
        this.value = value;
        this.dispatch(this.value);
    }
    public getValue() {
        return this.value;
    }
}

export type Listener<T> = (t: T) => void;

export class RegistryReader<T extends {}> extends Dispatcher<T>{
    private value!: T;
    constructor(private writer: RegistryWriter, private key: string, private defaults: T) {
        super();
        this.update();
        this.writer.subscribe(this.updateAndDispatch);
    }
    public getValue() {
        return this.value;
    }
    private updateAndDispatch = () => {
        this.update();
        this.dispatch(this.value);
    };
    private update() {
        this.value = { ...this.defaults, ...this.writer.getValue()[this.key] || {} };
    }
}
export class RuntimeConfigDefinition<VisibleAt extends EnvVisibility = Environment> extends FeatureInput<
    RegistryWriter,
    Environment,
    VisibleAt
    > {
    public entityId: {
        featureID: string, entityKey: string
    } | undefined;
    constructor(
        public id: string,
        public mergeConfig: MergeConfigHook<any> = (a: any, b: Partial<any>) => ({ ...a, ...b }),
        public visibleAt = (AllEnvironments as unknown) as VisibleAt
    ) {
        super(AllEnvironments, visibleAt);
    }

    public defineKey<T extends object>(defaultValue: T): RuntimeConfig<T, this['visibleAt']> {
        return new RuntimeConfig(this, defaultValue, this.mergeConfig, this.visibleAt);
    }

    public [CREATE_RUNTIME](_context: RuntimeEngine, featureID: string, entityKey: string) {
        this.entityId = {
            featureID,
            entityKey
        };
        return new RegistryWriter({});
    }

    public [REGISTER_VALUE](
        _context: RuntimeEngine,
        _providedValue: undefined,
        inputValue: any,
        _featureID: string,
        _entityKey: string
    ) {
        return inputValue;
    }
}


export class RuntimeConfig<T extends object, VisibleAt extends EnvVisibility = Environment> extends FeatureInput<
    RegistryReader<T>,
    Environment,
    VisibleAt
    > {
    public entityId: {
        featureID: string, entityKey: string
    } | undefined;
    constructor(
        private configDefinition: RuntimeConfigDefinition<VisibleAt>,
        public defaultValue: Readonly<T>,
        public mergeConfig: MergeConfigHook<T> = (a: T, b: Partial<T>) => ({ ...a, ...b }),
        visibleAt = (AllEnvironments as unknown) as VisibleAt
    ) {
        super(AllEnvironments, visibleAt);
    }
    public use(config: Partial<T>) {
        const identity = this.getIdentity();
        return [identity.featureID, { [identity.entityKey]: config }] as [string, Partial<T>];
    }

    public [IDENTIFY_API](featureID: string, entityKey: string) {
        this.entityId = {
            featureID,
            entityKey
        };
    }

    public [CREATE_RUNTIME](context: RuntimeEngine, featureID: string, entityKey: string) {
        const found = [...context.features.entries()].find(([feat]) => feat.id === this.configDefinition.entityId!.featureID);
        if (!found) {
            throw new Error('defining feature not found');
        }
        const live = found[1];
        const writer: RegistryWriter = live.api[this.configDefinition.entityId!.entityKey];
        const key = this.getKey();
        const topConfig = context.getTopLevelConfig(featureID, entityKey) as any[];
        const reduced = [this.defaultValue, ...topConfig].reduce((current, next) => {
            return this.mergeConfig(current, next);
        }, {} as SerializedConfig);
        return new RegistryReader<T>(writer, key, reduced);
    }

    public [REGISTER_VALUE](
        _context: RuntimeEngine,
        _providedValue: undefined,
        inputValue: any,
        _featureID: string,
        _entityKey: string
    ) {
        return inputValue;
    }

    public getIdentity() {
        if (!this.entityId) {
            throw new Error('trying to getIdentity before IDENTIFY_API called');
        }
        return this.entityId;
    }
    private getKey() {
        const identity = this.getIdentity();
        return entityID(identity.featureID, identity.entityKey);
    }
}
