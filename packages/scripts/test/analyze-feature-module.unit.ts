import { expect } from 'chai';

import { analyzeFeatureModule } from '@wixc3/engine-scripts';
import { evaluateModule } from '@wixc3/engine-scripts/src/utils/evaluate-module';
import { join } from 'path';

describe('analyzeFeatureModule', function () {
    it('analyzes a simple feature file', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = evaluateModule(join(__dirname, './fixtures/engine-feature/feature/x.feature'));
        const { name } = analyzeFeatureModule(module.children[0]);
        expect(name).to.eq('x');
    });

    it('located environment exports', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = evaluateModule(join(__dirname, './fixtures/node-env/feature/x.feature'));
        const { exportedEnvs } = analyzeFeatureModule(module.children[0]);
        expect(exportedEnvs).to.have.lengthOf(2);
        expect(exportedEnvs.map((e) => e.name)).to.eql(['main', 'server']);
    });

    it('locates used contexts', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = evaluateModule(join(__dirname, './fixtures/contextual/fixtures/server-env.feature'));
        const { usedContexts } = analyzeFeatureModule(module.children[0]);
        expect(usedContexts['contextual']).to.eql('server');
    });

    it('locates external dependencies', () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const moduleA = evaluateModule(join(__dirname, './fixtures/external-definitions/module-a.feature'));
        const moduleB = evaluateModule(join(__dirname, './fixtures/external-definitions/module-b.feature'));
        const { externalDefinitions } = analyzeFeatureModule(moduleA.children[0]);
        expect(externalDefinitions).to.eql([
            {
                request: 'my-module',
                globalName: 'MyModule',
            },
        ]);

        const { externalDefinitions: externalBDefinitions } = analyzeFeatureModule(moduleB.children[0]);

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
