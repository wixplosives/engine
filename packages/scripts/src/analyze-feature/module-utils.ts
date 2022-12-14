import { basename } from 'path';
import {
    Environment,
    EnvironmentContext,
    Feature,
    getFeaturesDeep,
    SingleEndpointContextualEnvironment,
    flattenTree,
    FeatureDescriptor,
} from '@wixc3/engine-core';
import { isFeatureFile, parseFeatureFileName } from '../build-constants';
import { instanceOf } from '../utils/instance-of';
import type { IFeatureDefinition, IFeatureModule } from '../types';
import { parseContextualEnv, parseEnv } from './parse-env';

function duckCheckFeature(maybeFeature: unknown): maybeFeature is FeatureDescriptor {
    return (
        typeof maybeFeature === 'object' &&
        maybeFeature !== null &&
        'id' in maybeFeature &&
        'api' in maybeFeature &&
        typeof (maybeFeature as any).id === 'string' &&
        typeof (maybeFeature as any).api === 'object' &&
        (maybeFeature as any).api !== null
    );
}

export function analyzeFeatureModule({ filename: filePath, exports }: NodeJS.Module): IFeatureModule {
    if (typeof exports !== 'object' || exports === null) {
        throw new Error(`${filePath} does not export an object.`);
    }

    const { default: exportedFeature } = exports as { default: FeatureDescriptor };

    if (!instanceOf(exportedFeature, Feature) || !duckCheckFeature(exportedFeature)) {
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
                if (instanceOf(exportValue, SingleEndpointContextualEnvironment)) {
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
        (m) => isFeatureFile(basename(m.filename))
    );

export function computeUsedContext(featureName: string, features: Map<string, IFeatureDefinition>) {
    const featureToDef = new Map<FeatureDescriptor, IFeatureDefinition>();
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
                    `Cannot find feature definition for feature with id: ${f.id}. This usually occurs due to duplicate engine/feature versions. Check your lock file.`
                );
            }
            return featureToDef.get(f)!;
        })
        .reduce((acc, { usedContexts }) => Object.assign(acc, usedContexts), {} as Record<string, string>);
}
