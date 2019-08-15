import { AsyncApi, EnvironmentInstanceToken } from '../com/types';
import { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, REGISTER_VALUE } from '../symbols';
import { EnvVisibility } from '../types';
import { AllEnvironments, Environment, normEnvVisibility, Universal } from './env';
import { FeatureOutput } from './output';

type ServiceRuntime<Type, ProvidedFrom> = ProvidedFrom extends Environment<string, 'single'>
    ? AsyncApi<Type>
    : ProvidedFrom extends Environment<string, 'multi'>
    ? {
          get(token: EnvironmentInstanceToken): AsyncApi<Type>;
      }
    : AsyncApi<Type>;

export class Service<
    T,
    PT,
    ProvidedFrom extends EnvVisibility,
    VisibleAt extends EnvVisibility,
    RemoteAccess extends boolean
> extends FeatureOutput<T, PT, ProvidedFrom, VisibleAt, RemoteAccess> {
    public static withType<T>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(providedFrom: E_ENV) {
                return new Service<T, T, E_ENV, E_ENV, false>(providedFrom, providedFrom, false);
            }
        };
    }
    private constructor(
        public providedFrom: ProvidedFrom,
        public visibleAt: VisibleAt,
        public remoteAccess: RemoteAccess
    ) {
        super(providedFrom, visibleAt, remoteAccess);
    }
    public allowRemoteAccess() {
        type U = ServiceRuntime<T, ProvidedFrom>;
        return new Service<T, U, ProvidedFrom, Environment, true>(this.providedFrom, AllEnvironments, true);
    }
    // public allowRemoteAccess<U extends ServiceRuntime<T, ProvidedFrom>> = ServiceRuntime<T, ProvidedFrom>>() {
    //     return new Service<T, U, ProvidedFrom, AllEnvironments>(this.providedFrom, AllEnvironments, true)
    // }
    public [REGISTER_VALUE](
        runtimeEngine: RuntimeEngine,
        providedValue: T | undefined,
        inputValue: PT,
        featureID: string,
        entityKey: string
    ) {
        if (this.remoteAccess) {
            const { communication } = runtimeEngine.getCOM().api;
            const serviceKey = runtimeEngine.entityID(featureID, entityKey);
            const providedFrom = normEnvVisibility(this.providedFrom);
            const localEnv = communication.getEnvironmentName();
            if (providedFrom.has(localEnv) || providedFrom.has(Universal.env)) {
                if (!providedValue) {
                    throw new Error('service is not provide in runtime');
                }
                communication.registerAPI({ id: serviceKey }, providedValue);
            }

            return inputValue || this.getApiProxy(runtimeEngine, serviceKey);
        }
        return providedValue;
    }
    public [CREATE_RUNTIME](context: RuntimeEngine, featureID: string, entityKey: string) {
        if (this.remoteAccess) {
            return this.getApiProxy(context, context.entityID(featureID, entityKey));
        }
    }
    // TODO: here!
    public getApiProxy(context: RuntimeEngine, serviceKey: string): any {
        const { communication } = context.getCOM().api;
        const instanceId = getSingleInstanceId(this.providedFrom);
        if (instanceId) {
            return communication.apiProxy<T>({ id: instanceId }, { id: serviceKey });
        } else {
            return {
                get(token: EnvironmentInstanceToken) {
                    return communication.apiProxy<T>(token, { id: serviceKey });
                }
            };
        }
    }
}
function getSingleInstanceId(providedFrom: any): string | void {
    if (isSingleInstance(providedFrom)) {
        return providedFrom.env;
    }
}

function isSingleInstance(providedFrom: any) {
    return providedFrom && providedFrom.endpointType && providedFrom.endpointType === 'single';
}
