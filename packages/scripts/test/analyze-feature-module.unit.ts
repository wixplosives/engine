import { expect } from 'chai';

import { analyzeFeatureModule } from '@wixc3/engine-scripts';
import { evaluateModule } from '@wixc3/engine-scripts/src/utils/evaluate-module';
import { join } from 'path';

describe('analyzeFeatureModule', function () {
    it('analyzes a simple feature file', () => {
        const {
            children: [featueModule],
        } = evaluateModule(join(__dirname, './fixtures/engine-feature/feature/x.feature'));
        const { name } = analyzeFeatureModule(featueModule);
        expect(name).to.eq('x');
    });

    it('located environment exports', () => {
        const {
            children: [featueModule],
        } = evaluateModule(join(__dirname, './fixtures/node-env/feature/x.feature'));
        const { exportedEnvs } = analyzeFeatureModule(featueModule);
        expect(exportedEnvs).to.have.lengthOf(2);
        expect(exportedEnvs.map((e) => e.name)).to.eql(['main', 'server']);
    });

    it('locates used contexts', () => {
        const {
            children: [featueModule],
        } = evaluateModule(join(__dirname, './fixtures/contextual/fixtures/server-env.feature'));
        const { usedContexts } = analyzeFeatureModule(featueModule);
        expect(usedContexts['contextual']).to.eql('server');
    });

    it('locates external dependencies', () => {
        const {
            children: [featureAModule],
        } = evaluateModule(join(__dirname, './fixtures/external-definitions/module-a.feature'));

        const { externalDefinitions } = analyzeFeatureModule(featureAModule);
        expect(externalDefinitions).to.eql([
            {
                request: 'my-module',
                globalName: 'MyModule',
            },
        ]);

        const {
            children: [featureBModule],
        } = evaluateModule(join(__dirname, './fixtures/external-definitions/module-b.feature'));
        const { externalDefinitions: externalBDefinitions } = analyzeFeatureModule(featureBModule);

        expect(externalBDefinitions).to.eql([
            {
                globalName: 'MyOtherModule',
                request: 'my-other-module',
            },
            { request: 'mod', globalName: 'Mod' },
            {
                globalName: 'AnotherOtherModule',
                request: 'another-other-module',
            },
        ]);
    });
});
