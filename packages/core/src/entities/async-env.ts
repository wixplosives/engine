import { EnvironmentTypes } from '../com/types';
import { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, REGISTER_VALUE } from '../symbols';
import { EnvVisibility } from '../types';
import { EndpointType, Environment, NoEnvironments } from './env';
import { FeatureOutput } from './output';

interface EnvironmentToken {
    id: string;
}

interface EnvSpawner {
    requestEnvironment(request: string): Promise<EnvironmentToken>;
}

// TODO: we can remove the FeatureOutput if we not using it anymore

export class SingleEndPointAsyncEnvironment<ID extends string, ENV extends EnvVisibility> extends FeatureOutput<
    EnvSpawner,
    never,
    ENV,
    typeof NoEnvironments,
    false
> {
    public endpointType = 'single' as const;
    public visibleAt = NoEnvironments;
    constructor(public env: ID, public envType: EnvironmentTypes, providedFrom: ENV) {
        super(providedFrom, NoEnvironments, false);
    }
    public [CREATE_RUNTIME]() {
        /* */
    }
    public [REGISTER_VALUE](
        _context: RuntimeEngine,
        _providedValue: EnvSpawner,
        inputValue: never,
        _featureID: string,
        _entityKey: string
    ) {
        /* */
        return inputValue;
    }
}

export class MultiEndPointAsyncEnvironment<ID extends string, ENV extends EnvVisibility> extends FeatureOutput<
    EnvSpawner,
    never,
    ENV,
    typeof NoEnvironments,
    false
> {
    public endpointType = 'multi' as const;
    public visibleAt = NoEnvironments;
    constructor(public env: ID, public envType: EnvironmentTypes, providedFrom: ENV) {
        super(providedFrom, NoEnvironments, false);
    }
    public [CREATE_RUNTIME]() {
        /* */
    }
    public [REGISTER_VALUE](
        _context: RuntimeEngine,
        _providedValue: EnvSpawner,
        inputValue: never,
        _featureID: string,
        _entityKey: string
    ) {
        /* */
        return inputValue;
    }
}

export type AsyncEnvironment =
    | SingleEndPointAsyncEnvironment<string, EnvVisibility>
    | MultiEndPointAsyncEnvironment<string, EnvVisibility>
    | Environment<string, EndpointType>;

export type AsyncSingleEndpointEnvironment =
    | SingleEndPointAsyncEnvironment<string, EnvVisibility>
    | Environment<string, 'single'>;
