import { buildFeatureLinks } from '@wixc3/engineer/dist/feature-dependency-graph';
import { Feature } from '@wixc3/engine-core';
import { expect } from 'chai';

class noDepsFeature extends Feature<'noDepsFeature'> {
    id = 'noDepsFeature' as const;
    api = {};
    dependencies = [];
}
class simpleDepFeature extends Feature<'simpleDepFeature'> {
    id = 'simpleDepFeature' as const;
    api = {};
    dependencies = [noDepsFeature];
}
class shareDepWithDepFeature extends Feature<'shareDepWithDepFeature'> {
    id = 'shareDepWithDepFeature' as const;
    api = {};
    dependencies = [noDepsFeature, simpleDepFeature];
}
class multiLevelFeature extends Feature<'multLevel'> {
    id = 'multLevel' as const;
    api = {};
    dependencies = [simpleDepFeature, shareDepWithDepFeature];
}

describe('buildFeatureLinks', () => {
    it('should handle feature with no dependencies', () => {
        expect(buildFeatureLinks(noDepsFeature)).to.eql({
            nodes: [{ name: noDepsFeature.id, group: 0 }],
            links: [],
        });
    });
    it('should handle features with single direction depedencies', () => {
        expect(buildFeatureLinks(simpleDepFeature)).to.eql({
            nodes: [
                { name: simpleDepFeature.id, group: 0 },
                { name: noDepsFeature.id, group: 1 },
            ],
            links: [{ source: simpleDepFeature.id, target: noDepsFeature.id }],
        });
    });
    it('should handle features that share dependencies with their dependencies', () => {
        expect(buildFeatureLinks(shareDepWithDepFeature)).to.eql({
            nodes: [
                { name: shareDepWithDepFeature.id, group: 0 },
                { name: noDepsFeature.id, group: 1 },
                { name: simpleDepFeature.id, group: 1 },
            ],
            links: [
                { source: shareDepWithDepFeature.id, target: noDepsFeature.id },
                { source: shareDepWithDepFeature.id, target: simpleDepFeature.id },
                { source: simpleDepFeature.id, target: noDepsFeature.id },
            ],
        });
    });
    it('should handle multi level features with complex dependencies', () => {
        expect(buildFeatureLinks(multiLevelFeature)).to.eql({
            nodes: [
                { name: multiLevelFeature.id, group: 0 },
                { name: simpleDepFeature.id, group: 1 },
                { name: shareDepWithDepFeature.id, group: 1 },
                { name: noDepsFeature.id, group: 2 },
            ],
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
