import fs from '@file-services/node';

import { expect } from 'chai';
import {
    createWebpackConfigForExteranlFeature,
    getExportedEnvironments,
    getResolvedEnvironments,
    loadFeaturesFromPaths,
} from '@wixc3/engine-scripts';
import type webpack from 'webpack';

describe('create webpack config', () => {
    describe('external webpack config', () => {
        const getFeatureAnalyzis = (featureName: string, featurePath: string, basePath: string) => {
            const { configurations, features } = loadFeaturesFromPaths(new Set([featurePath]), new Set([basePath]), fs);

            const { webEnvs } = getResolvedEnvironments({
                featureName,
                features,
                filterContexts: false,
                environments: [...getExportedEnvironments(features)],
            });

            return {
                features,
                configurations,
                environments: webEnvs,
                target: 'web' as const,
            };
        };

        const baseConfig = (featureName: string) => ({
            baseConfig: {},
            featureName,
            virtualModules: {},
            context: __dirname,
            externalFeatures: [],
            outputPath: './',
            staticBuild: false,
        });

        it('externalizes @wixc3/engine-core', () => {
            const featureName = 'application-external';
            const featureFilePath = fs.join(__dirname, './fixtures/application-external/application-external.feature');

            const { externals } = createWebpackConfigForExteranlFeature({
                ...baseConfig(featureName),
                ...getFeatureAnalyzis(featureName, featureFilePath, fs.dirname(featureFilePath)),
            });
            expect(externals).to.be.an('Array');

            const externalEngineCore = (externals as webpack.ExternalsElement[])[0] as webpack.ExternalsObjectElement;

            expect(externalEngineCore?.['@wixc3/engine-core']).to.eq('EngineCore');
        });

        it('externalizes external feature packages', () => {
            const featureName = 'application-external-definitions/module-b';
            const featureFilePath = fs.join(__dirname, './fixtures/external-definitions/module-b.feature');

            const { externals } = createWebpackConfigForExteranlFeature({
                ...baseConfig(featureName),
                ...getFeatureAnalyzis(featureName, featureFilePath, fs.dirname(featureFilePath)),
            });
            expect(externals).to.be.an('Array');

            const externalsDefinition = (externals as webpack.ExternalsElement[])[1] as webpack.ExternalsObjectElement;

            expect(Object.keys(externalsDefinition)).to.have.lengthOf(4);
            expect(externalsDefinition).to.include.keys('my-module', 'another-other-module');
            expect(externalsDefinition['another-other-module']).to.eq('AnotherOtherModule');
        });
    });
});
