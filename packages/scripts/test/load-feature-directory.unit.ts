import { createMemoryFs } from '@file-services/memory';
import { expect } from 'chai';
import { loadFeatureDirectory } from '../src/load-feature-directory';

describe('loadFeatureDirectory', () => {
    it('locates engine entity files for a given directory', () => {
        const fs = createMemoryFs({
            src: {
                'my-thing.feature.ts': ``,
                'my-thing.main.env.ts': ``,
                'my-config.config.ts': ``,
                'my-config2.config.ts': ``,
                'main.test.context.ts': ``
            }
        });

        const directoryPath = '/src';
        const results = loadFeatureDirectory({ fs, directoryPath });

        expect(results).to.eql({
            directoryPath,
            features: ['/src/my-thing.feature'],
            configurations: ['/src/my-config.config', '/src/my-config2.config'],
            envs: ['/src/my-thing.main.env'],
            contexts: ['/src/main.test.context']
        });
    });

    it('ignores sub directories by default', () => {
        const fs = createMemoryFs({
            src: {
                'my-thing.feature.ts': ``,
                'my-config.config.ts': ``,
                'my-config2.config.ts': ``,
                sub: {
                    'my-config3.config.ts': ``
                }
            }
        });

        const directoryPath = '/src';
        const { configurations } = loadFeatureDirectory({ fs, directoryPath });
        expect(configurations).to.not.include('/src/sub/my-config3.config');
    });

    it('supports multiple features getting picked up', () => {
        const fs = createMemoryFs({
            'my-thing.feature.ts': ``,
            'my-thing2.feature.ts': ``,
            'my-config.config.ts': ``,
            'my-config2.config.ts': ``
        });

        const directoryPath = '/';
        const results = loadFeatureDirectory({ fs, directoryPath });

        expect(results).to.eql({
            directoryPath,
            features: ['/my-thing.feature', '/my-thing2.feature'],
            configurations: ['/my-config.config', '/my-config2.config'],
            envs: [],
            contexts: []
        });
    });
});
