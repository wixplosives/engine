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
const multiLevelFeature = new Feature({
    id: 'multLevel',
    dependencies: [simpleDepFeature.asEntity, shareDepWithDepFeature.asEntity],
    api: {},
});

describe.only('buildFeatureLinks', () => {
    it('should handle feature with no dependencies', () => {
        expect(buildFeatureLinks(noDepsFeature)).to.eql({
            nodes: {
                [noDepsFeature.id]: { name: noDepsFeature.id, group: 0 },
            },
            links: [],
        });
    });
    it('should handle features with single direction depedencies', () => {
        expect(buildFeatureLinks(simpleDepFeature)).to.eql({
            nodes: {
                [simpleDepFeature.id]: { name: simpleDepFeature.id, group: 0 },
                [noDepsFeature.id]: { name: noDepsFeature.id, group: 1 },
            },
            links: [{ source: simpleDepFeature.id, target: noDepsFeature.id }],
        });
    });
    it('should handle features that share dependencies with their dependencies', () => {
        expect(buildFeatureLinks(shareDepWithDepFeature)).to.eql({
            nodes: {
                [shareDepWithDepFeature.id]: { name: shareDepWithDepFeature.id, group: 0 },
                [noDepsFeature.id]: { name: noDepsFeature.id, group: 1 },
                [simpleDepFeature.id]: { name: simpleDepFeature.id, group: 1 },
            },
            links: [
                { source: shareDepWithDepFeature.id, target: noDepsFeature.id },
                { source: shareDepWithDepFeature.id, target: simpleDepFeature.id },
                { source: simpleDepFeature.id, target: noDepsFeature.id },
            ],
        });
    });
    it('should handle multi level features with complex dependencies', () => {
        expect(buildFeatureLinks(multiLevelFeature)).to.eql({
            nodes: {
                [multiLevelFeature.id]: { name: multiLevelFeature.id, group: 0 },
                [shareDepWithDepFeature.id]: { name: shareDepWithDepFeature.id, group: 1 },
                [simpleDepFeature.id]: { name: simpleDepFeature.id, group: 1 },
                [noDepsFeature.id]: { name: noDepsFeature.id, group: 2 },
            },
            links: [
                { source: multiLevelFeature.id, target: simpleDepFeature.id },
                { source: multiLevelFeature.id, target: shareDepWithDepFeature.id },
                { source: simpleDepFeature.id, target: noDepsFeature.id },
                { source: shareDepWithDepFeature.id, target: noDepsFeature.id },
                { source: shareDepWithDepFeature.id, target: simpleDepFeature.id },
            ],
        });
    });
});
