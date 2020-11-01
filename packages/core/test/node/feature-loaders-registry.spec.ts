import { FeatureLoadersRegistry, Feature, IFeatureLoader } from '@wixc3/engine-core';
import chai, { expect } from 'chai';
import { spy } from 'sinon';
import sinon from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { waitFor } from 'promise-assist';
chai.use(sinon);
chai.use(chaiAsPromised);

describe('Feature loader registry', () => {
    it('loads a feature', async () => {
        const loaded = spy();
        const f = new Feature({
            id: 'test',
            api: {},
        });
        const featureLoader: IFeatureLoader = {
            depFeatures: [],
            load: () => {
                loaded();
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const registry = new FeatureLoadersRegistry();
        registry.register('test', featureLoader);
        expect(registry.get('test')).to.eq(featureLoader);
        expect(loaded).to.have.callCount(0);
        await registry.getLoadedFeatures('test');
        expect(loaded).to.have.callCount(1);
    });

    it('loads a feature with dependencies', async () => {
        const loaded = spy();
        const depLoaded = spy();
        const f = new Feature({
            id: 'test',
            api: {},
        });
        const featureLoader: IFeatureLoader = {
            depFeatures: ['dep'],
            load: () => {
                loaded();
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const depFeatureLoader: IFeatureLoader = {
            depFeatures: [],
            load: () => {
                depLoaded();
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const registry = new FeatureLoadersRegistry();
        registry.register('test', featureLoader);
        registry.register('dep', depFeatureLoader);
        await registry.getLoadedFeatures('test');
        expect(depLoaded).to.have.callCount(1);
        expect(loaded).to.have.callCount(1);
    });

    it('does not load a feature without its dependencies', async () => {
        const loaded = spy();
        const f = new Feature({
            id: 'test',
            api: {},
        });
        const featureLoader: IFeatureLoader = {
            depFeatures: ['dep'],
            load: () => {
                loaded();
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const depFeatureLoader: IFeatureLoader = {
            depFeatures: [],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const registry = new FeatureLoadersRegistry();
        registry.register('test', featureLoader);
        const p = registry.getLoadedFeatures('test');
        const callbackCall = spy();
        void p.then(callbackCall);
        await waitFor(() => expect(callbackCall).to.have.callCount(0), { delay: 100 });
        registry.register('dep', depFeatureLoader);
        await waitFor(() => expect(callbackCall).to.have.callCount(1));
    });

    it('retrieves all feature deep dependencies', async () => {
        const f = new Feature({
            id: 'test',
            api: {},
        });
        const featureLoader: IFeatureLoader = {
            depFeatures: ['dep'],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };
        const dep: IFeatureLoader = {
            depFeatures: ['dep1', 'dep2'],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };
        const dep1: IFeatureLoader = {
            depFeatures: ['dep3'],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };
        const dep2: IFeatureLoader = {
            depFeatures: ['dep4'],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const dep3: IFeatureLoader = {
            depFeatures: [],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const dep4: IFeatureLoader = {
            depFeatures: ['dep3'],
            load: () => {
                return Promise.resolve(f);
            },
            resolvedContexts: {},
        };

        const registry = new FeatureLoadersRegistry();
        registry.register('test', featureLoader);
        registry.register('dep', dep);
        registry.register('dep1', dep1);
        registry.register('dep2', dep2);
        registry.register('dep3', dep3);
        registry.register('dep4', dep4);

        expect(await registry.getFeatureDependencies('test')).to.equal;
        ['test', 'dep', 'dep1', 'dep2', 'dep3', 'dep4'];

        expect(await registry.getFeatureDependencies('dep2')).to.equal;
        ['dep2', 'dep3', 'dep4'];
    });
});
