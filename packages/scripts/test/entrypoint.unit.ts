import { Environment } from '@wixc3/engine-core';
import type { IEnvironment } from '@wixc3/engine-runtime-node';
import { expect } from 'chai';
import { getExportedEnvironments, getResolvedEnvironments, IFeatureDefinition } from '../src';

describe('create entrypoint', () => {
    describe('resolve environments', () => {
        it('properly maps environments', () => {
            const baseEnv = new Environment('base', 'window', 'multi');
            const clientEnv = new Environment('client', 'window', 'single', [baseEnv]);
            const analyzedBaseEnv = { env: baseEnv, name: baseEnv.env, type: baseEnv.envType } as IEnvironment;
            const features = new Map<string, Pick<IFeatureDefinition, 'resolvedContexts' | 'exportedEnvs'>>([
                [
                    'myFeature',
                    {
                        exportedEnvs: [
                            analyzedBaseEnv,
                            {
                                name: clientEnv.env,
                                type: clientEnv.envType,
                                dependencies: [analyzedBaseEnv],
                                env: clientEnv,
                            } as IEnvironment,
                        ],
                        resolvedContexts: {},
                    },
                ],
            ]);

            const environments = [...getExportedEnvironments(features)];
            const resolvedEnvironments = getResolvedEnvironments({
                featureName: 'myFeature',
                features,
                filterContexts: true,
                environments,
            });
            expect(resolvedEnvironments.webEnvs.size).to.eq(2);
        });
    });
});
