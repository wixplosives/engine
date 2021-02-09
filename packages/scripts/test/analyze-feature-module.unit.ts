import { expect } from 'chai';

import { analyzeFeatureModule } from '@wixc3/engine-scripts';
import { evaluateModule } from '@wixc3/engine-scripts/src/utils/evaluate-module';
import { join } from 'path';
import type { ExternalDefinition } from '@wixc3/engine-core';

const pathToBasicFeature = join(__dirname, './fixtures/engine-feature/feature/x.feature');
const pathTofFeatureWithExportedEnvironment = join(__dirname, './fixtures/node-env/feature/x.feature');
const pathToFeatureWithExportedUsedContexts = join(__dirname, './fixtures/contextual/fixtures/server-env.feature');
const pathToFeatureWithSingleExternalDefinition = join(__dirname, './fixtures/external-definitions/module-a.feature');
const pathToFeatureWithMultipleExternalDefinitions = join(
    __dirname,
    './fixtures/external-definitions/module-b.feature'
);

describe('analyzeFeatureModule', function () {
    it('analyzes a simple feature file', () => {
        const {
            children: [featueModule],
        } = evaluateModule(pathToBasicFeature);
        const { name } = analyzeFeatureModule(featueModule);
        expect(name).to.eq('x');
    });

    it('located environment exports', () => {
        const {
            children: [featueModule],
        } = evaluateModule(pathTofFeatureWithExportedEnvironment);
        const { exportedEnvs } = analyzeFeatureModule(featueModule);
        expect(exportedEnvs).to.have.lengthOf(2);
        expect(exportedEnvs.map((e) => e.name)).to.eql(['main', 'server']);
    });

    it('locates used contexts', () => {
        const {
            children: [featueModule],
        } = evaluateModule(pathToFeatureWithExportedUsedContexts);
        const { usedContexts } = analyzeFeatureModule(featueModule);
        expect(usedContexts['contextual']).to.eql('server');
    });

    it('locates external dependencies', async () => {
        const {
            children: [featureAModule],
        } = evaluateModule(pathToFeatureWithSingleExternalDefinition);

        const { externalDefinitions } = analyzeFeatureModule(featureAModule);

        const { externalModule: moduleAExternalModule } = (await import(pathToFeatureWithSingleExternalDefinition)) as {
            externalModule: ExternalDefinition;
        };
        expect(externalDefinitions).to.eql([moduleAExternalModule]);

        const {
            children: [featureBModule],
        } = evaluateModule(pathToFeatureWithMultipleExternalDefinitions);

        const { externalDefinitions: externalBDefinitions } = analyzeFeatureModule(featureBModule);

        const { externalModule, externalModules } = (await import(pathToFeatureWithMultipleExternalDefinitions)) as {
            externalModule: ExternalDefinition;
            externalModules: ExternalDefinition[];
        };
        expect(externalBDefinitions).to.eql([...externalModules, externalModule]);
    });
});
