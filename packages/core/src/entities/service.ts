import COM from '../communication.feature';
import type { AsyncApi, EnvironmentInstanceToken, EnvironmentTypes, ServiceComConfig } from '../com/types';
import type { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, REGISTER_VALUE } from '../symbols';
import type { EnvVisibility } from '../types';
import { AllEnvironments, Environment, normEnvVisibility, Universal } from './env';
import { FeatureOutput } from './output';

export type ServiceRuntime<T extends object, ProvidedFrom> = ProvidedFrom extends Environment<
    string,
    EnvironmentTypes,
    'single'
>
    ? AsyncApi<T>
    : ProvidedFrom extends Environment<string, EnvironmentTypes, 'multi', any>
    ? {
          get(token: EnvironmentInstanceToken): AsyncApi<T>;
      }
    : AsyncApi<T>;

export class Service<
    T extends object,
    PT,
    ProvidedFrom extends EnvVisibility,
    VisibleAt extends EnvVisibility,
    RemoteAccess extends boolean
> extends FeatureOutput<T, PT, ProvidedFrom, VisibleAt, RemoteAccess> {
    public static withType<T extends object>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(providedFrom: E_ENV) {
                return new Service<T, T, E_ENV, E_ENV, false>(providedFrom, providedFrom, false);
            },
        };
    }
    private constructor(
        public providedFrom: ProvidedFrom,
        public visibleAt: VisibleAt,
        public remoteAccess: RemoteAccess,
        private options: ServiceComConfig<T> = {}
    ) {
        super(providedFrom, visibleAt, remoteAccess);
    }
    public allowRemoteAccess(options?: ServiceComConfig<T>) {
        return new Service<T, ServiceRuntime<T, ProvidedFrom>, ProvidedFrom, Environment, true>(
            this.providedFrom,
            AllEnvironments,
            true,
            options
        );
    }

    public [REGISTER_VALUE](
        runtimeEngine: RuntimeEngine,
        providedValue: T | undefined,
        inputValue: PT,
        featureID: string,
        entityKey: string
    ) {
        if (this.remoteAccess) {
            const { communication } = runtimeEngine.get(COM).api;
            const serviceKey = runtimeEngine.entityID(featureID, entityKey);
            const providedFrom = normEnvVisibility(this.providedFrom);
            const localEnv = communication.getEnvironmentName();
            if (providedFrom.has(localEnv) || providedFrom.has(Universal.env)) {
                if (!providedValue) {
                    throw new Error(
                        `Service is not provided in runtime.
                        Make sure environment setup file exist and correctly typed: [featureName].[envName].env.[ext]`
                    );
                }
                communication.registerAPI({ id: serviceKey }, providedValue);
                return providedValue;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return inputValue || this.getApiProxy(runtimeEngine, serviceKey);
        }
        return providedValue;
    }

    public [CREATE_RUNTIME](context: RuntimeEngine, featureID: string, entityKey: string) {
        if (this.remoteAccess) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return this.getApiProxy(context, context.entityID(featureID, entityKey));
        }
    }

    public getApiProxy(context: RuntimeEngine, serviceKey: string): any {
        const { communication } = context.get(COM).api;
        const instanceId = getSingleInstanceId(this.providedFrom);
        if (instanceId) {
            return communication.apiProxy<T>({ id: instanceId }, { id: serviceKey }, this.options);
        } else {
            return {
                get: (token: EnvironmentInstanceToken) => {
                    return communication.apiProxy<T>(token, { id: serviceKey }, this.options);
                },
            };
        }
    }
}

function getSingleInstanceId(providedFrom: unknown): string | void {
    if (isSingleInstance(providedFrom)) {
        return providedFrom.env;
    }
}

function isSingleInstance(providedFrom: unknown): providedFrom is Environment<string, EnvironmentTypes, 'single'> {
    return (
        !!providedFrom &&
        (providedFrom as Environment).endpointType &&
        (providedFrom as Environment).endpointType === 'single'
    );
}
