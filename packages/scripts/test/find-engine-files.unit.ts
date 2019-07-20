import { createMemoryFs } from '@file-services/memory';
import { expect } from 'chai';
import { findEngineFiles } from '../src/engine-utils/find-engine-files';

describe('findEngineFiles', () => {
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

        const results = findEngineFiles({ fs, directoryPath: '/src' });

        expect(results).to.eql({
            features: ['/src/my-thing.feature.ts'],
            configurations: ['/src/my-config.config.ts', '/src/my-config2.config.ts'],
            envs: ['/src/my-thing.main.env.ts'],
            contexts: ['/src/main.test.context.ts']
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

        const { configurations } = findEngineFiles({ fs, directoryPath: '/src' });
        expect(configurations).to.not.include('/src/sub/my-config3.config.ts');
    });

    it('supports multiple features getting picked up', () => {
        const fs = createMemoryFs({
            'my-thing.feature.ts': ``,
            'my-thing2.feature.ts': ``,
            'my-config.config.ts': ``,
            'my-config2.config.ts': ``
        });

        const results = findEngineFiles({ fs, directoryPath: '/' });

        expect(results).to.eql({
            features: ['/my-thing.feature.ts', '/my-thing2.feature.ts'],
            configurations: ['/my-config.config.ts', '/my-config2.config.ts'],
            envs: [],
            contexts: []
        });
    });
});
