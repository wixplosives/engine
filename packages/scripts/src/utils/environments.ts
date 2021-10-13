import { AnyEnvironment, SetMultiMap } from '@wixc3/engine-core';
import type { IEnvironment } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition } from '../types';

export interface GetResolveEnvironmentsParams {
    featureName?: string;
    filterContexts?: boolean;
    features: Map<string, Pick<IFeatureDefinition, 'exportedEnvs' | 'resolvedContexts'>>;
    environments: IEnvironment[];
    findAllEnvironments?: boolean;
}

export interface ISimplifiedEnvironment {
    childEnvs: string[];
    env: AnyEnvironment;
}

export function getResolvedEnvironments({
    featureName,
    filterContexts,
    features,
    environments,
    findAllEnvironments,
}: GetResolveEnvironmentsParams) {
    const webEnvs = new Map<string, ISimplifiedEnvironment>();
    const workerEnvs = new Map<string, ISimplifiedEnvironment>();
    const electronRendererEnvs = new Map<string, ISimplifiedEnvironment>();
    const nodeEnvs = new Map<string, ISimplifiedEnvironment>();
    const electronMainEnvs = new Map<string, ISimplifiedEnvironment>();

    const resolvedContexts = findAllEnvironments
        ? getPossibleContexts(features)
        : featureName && filterContexts
        ? convertEnvRecordToSetMultiMap(features.get(featureName)?.resolvedContexts ?? {})
        : getAllResolvedContexts(features);
    for (const env of environments) {
        const { name, childEnvName, type } = env;
        if (!resolvedContexts.hasKey(name) || (childEnvName && resolvedContexts.get(name)?.has(childEnvName)))
            if (type === 'window' || type === 'iframe') {
                addEnv(webEnvs, env);
            } else if (type === 'worker') {
                addEnv(workerEnvs, env);
            } else if (type === 'electron-renderer') {
                addEnv(electronRendererEnvs, env);
            } else if (type === 'node') {
                addEnv(nodeEnvs, env);
            } else if (type === 'electron-main') {
                addEnv(electronMainEnvs, env);
            }
    }
    return {
        webEnvs,
        workerEnvs,
        electronRendererEnvs,
        nodeEnvs,
    };
}

function addEnv(envs: Map<string, ISimplifiedEnvironment>, { name, childEnvName, env: environment }: IEnvironment) {
    const env: ISimplifiedEnvironment = envs.get(name) || {
        childEnvs: [],
        env: environment,
    };
    if (childEnvName) {
        env.childEnvs.push(childEnvName);
    }
    envs.set(name, env);
}

function getAllResolvedContexts(features: Map<string, Pick<IFeatureDefinition, 'resolvedContexts'>>) {
    const allContexts = new SetMultiMap<string, string>();
    for (const { resolvedContexts } of features.values()) {
        convertEnvRecordToSetMultiMap(resolvedContexts, allContexts);
    }
    return allContexts;
}

function getPossibleContexts(features: Map<string, Pick<IFeatureDefinition, 'exportedEnvs'>>) {
    const allContexts = new SetMultiMap<string, string>();
    for (const { exportedEnvs } of features.values()) {
        for (const env of exportedEnvs) {
            if (env.childEnvName) {
                allContexts.add(env.name, env.childEnvName);
            }
        }
    }
    return allContexts;
}

function convertEnvRecordToSetMultiMap(record: Record<string, string>, set = new SetMultiMap<string, string>()) {
    for (const [env, resolvedContext] of Object.entries(record)) {
        set.add(env, resolvedContext);
    }
    return set;
}
