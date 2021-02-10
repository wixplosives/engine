import { buildFeatureLinks } from '@wixc3/engineer/dist/feature-dependency-graph';
import { Feature } from '@wixc3/engine-core';
import { expect } from 'chai';

const noDepsFeature = new Feature({
    id: 'noDepsFeature',
    dependencies: [],
    api: {},
});
const simpleDepFeature = new Feature({
    id: 'simpleDepFeature',
    dependencies: [noDepsFeature.asEntity],
    api: {},
});
const shareDepWithDepFeature = new Feature({
    id: 'shareDepWithDepFeature',
    dependencies: [noDepsFeature.asEntity, simpleDepFeature.asEntity],
    api: {},
});

describe('buildFeatureLinks', () => {
    it('should handle feature with no dependencies', () => {
        expect(buildFeatureLinks(noDepsFeature)).to.eql({
            visitedFeatures: {
                [noDepsFeature.id]: 0,
            },
            links: [],
        });
    });
    it('should handle features with single direction depedencies', () => {
        expect(buildFeatureLinks(simpleDepFeature)).to.eql({
            visitedFeatures: {
                [simpleDepFeature.id]: 0,
                [noDepsFeature.id]: 1,
            },
            links: [{ source: simpleDepFeature.id, target: noDepsFeature.id }],
        });
    });
    it('should handle features that share dependencies with their dependencies', () => {
        expect(buildFeatureLinks(shareDepWithDepFeature)).to.eql({
            visitedFeatures: {
                [shareDepWithDepFeature.id]: 0,
                [noDepsFeature.id]: 1,
                [simpleDepFeature.id]: 1,
            },
            links: [
                { source: shareDepWithDepFeature.id, target: noDepsFeature.id },
                { source: shareDepWithDepFeature.id, target: simpleDepFeature.id },
                { source: simpleDepFeature.id, target: noDepsFeature.id },
            ],
        });
    });
});
