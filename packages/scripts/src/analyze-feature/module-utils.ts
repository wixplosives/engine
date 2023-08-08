import {
    ContextualEnvironment,
    Environment,
    EnvironmentContext,
    flattenTree,
    type FeatureClass,
} from '@wixc3/engine-core';
import { basename } from 'node:path';
import { isFeatureFile, parseFeatureFileName } from '../build-constants.js';
import type { IFeatureDefinition, IFeatureModule } from '../types.js';
import { instanceOf } from '../utils/instance-of.js';
import { parseContextualEnv, parseEnv } from './parse-env.js';

function isEngineFeature(Class: unknown) {
    return typeof Class === 'function' && (Class as FeatureClass).isEngineFeature;
}

function getFeaturesDeep(feature: FeatureClass) {
    return flattenTree(feature, (f) => f.dependencies());
}

export function analyzeFeatureModule({ filename: filePath, exports }: NodeJS.Module): IFeatureModule {
    if (typeof exports !== 'object' || exports === null) {
        throw new Error(`${filePath} does not export an object.`);
    }

    const { default: exportedFeature } = exports as { default: FeatureClass };

    if (!isEngineFeature(exportedFeature)) {
        throw new Error(`${filePath} does not "export default" a Feature.`);
    }

    const featureFile: IFeatureModule = {
        filePath,
        name: parseFeatureFileName(basename(filePath)),
        exportedFeature,
        exportedEnvs: [],
        usedContexts: {},
    };

    if (typeof exports === 'object' && exports !== null) {
        const { exportedEnvs: envs = [], usedContexts = {} } = featureFile;
        for (const exportValue of Object.values(exports)) {
            if (instanceOf(exportValue, Environment)) {
                if (instanceOf(exportValue, ContextualEnvironment)) {
                    envs.push(...parseContextualEnv(exportValue));
                } else {
                    envs.push(parseEnv(exportValue));
                }
            } else if (instanceOf(exportValue, EnvironmentContext)) {
                usedContexts[exportValue.env] = exportValue.activeEnvironmentName;
            }
        }
    }
    return featureFile;
}

export const getFeatureModules = (module: NodeJS.Module) =>
    flattenTree(
        module,
        (m) => m.children,
        (m) => isFeatureFile(basename(m.filename)),
    );

export function computeUsedContext(featureName: string, features: Map<string, IFeatureDefinition>) {
    const featureToDef = new Map<FeatureClass, IFeatureDefinition>();
    for (const featureDef of features.values()) {
        featureToDef.set(featureDef.exportedFeature, featureDef);
    }

    const feature = features.get(featureName);
    if (!feature) {
        throw new Error(`context compute: cannot find feature "${featureName}"`);
    }

    return Array.from(getFeaturesDeep(feature.exportedFeature))
        .reverse()
        .map((f) => {
            if (!featureToDef.has(f)) {
                throw new Error(
                    `Cannot find feature definition for feature with id: ${f.id}. This usually occurs due to duplicate engine/feature versions. Check your lock file.`,
                );
            }
            return featureToDef.get(f)!;
        })
        .reduce((acc, { usedContexts }) => Object.assign(acc, usedContexts), {} as Record<string, string>);
}
