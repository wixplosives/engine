import { SetMultiMap } from '@wixc3/engine-core';
import type { IEnvironment } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition } from '../types';

export interface GetResolveEnvironmentsParams {
    featureName?: string;
    filterContexts?: boolean;
    features: Map<string, IFeatureDefinition>;
    environments: IEnvironment[];
    findAllEnviromnents?: boolean;
}

export function getResolvedEnvironments({
    featureName,
    filterContexts,
    features,
    environments,
    findAllEnviromnents,
}: GetResolveEnvironmentsParams) {
    const webEnvs = new Map<string, string[]>();
    const workerEnvs = new Map<string, string[]>();
    const electronRendererEnvs = new Map<string, string[]>();
    const nodeEnvs = new Map<string, string[]>();
    const electronMainEnvs = new Map<string, string[]>();

    const resolvedContexts = findAllEnviromnents
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

function addEnv(envs: Map<string, string[]>, { name, childEnvName }: IEnvironment) {
    const childEnvs = envs.get(name) || [];
    if (childEnvName) {
        childEnvs.push(childEnvName);
    }
    envs.set(name, childEnvs);
}

function getAllResolvedContexts(features: Map<string, IFeatureDefinition>) {
    const allContexts = new SetMultiMap<string, string>();
    for (const { resolvedContexts } of features.values()) {
        convertEnvRecordToSetMultiMap(resolvedContexts, allContexts);
    }
    return allContexts;
}

function getPossibleContexts(features: Map<string, IFeatureDefinition>) {
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
