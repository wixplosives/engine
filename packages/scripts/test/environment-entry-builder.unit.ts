import { evalEntry } from '@wixc3/engine-test-kit';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { EnvironmentEntryBuilder } from '../src/engine-utils/environment-entry-builder';

chai.use(sinonChai);

describe('environment-entry-builder (web target)', () => {
    describe('dynamic entry build', () => {
        it(`by default use first .config as top level config`, async () => {
            const entry = new EnvironmentEntryBuilder().buildDynamic({
                name: 'test',
                target: 'web',
                envFiles: new Set(['/feature-name.test.env.ts']),
                featureMapping: {
                    rootFeatureName: 'feature-name',
                    mapping: {
                        'feature-name': {
                            featureFilePath: '/feature-name.feature.ts',
                            configurations: {
                                public: '/public.config.ts',
                                public2: '/public2.config.ts'
                            },
                            context: {
                                envA: 'b'
                            }
                        }
                    },
                    bootstrapFeatures: []
                }
            });

            const { getRequireCalls, getRunningFeatures, getTopLevelConfig, moduleExports } = evalEntry(entry);

            // Static calls
            expect(getRequireCalls()).to.eql(['/feature-name.test.env.ts', '@wixc3/engine-core']);

            await moduleExports.default;

            // Dynamic call to config
            expect(getRequireCalls()).to.eql([
                '/feature-name.test.env.ts',
                '@wixc3/engine-core',
                '/feature-name.feature.ts',
                '/public.config.ts'
            ]);

            expect(getRunningFeatures()).to.eql(['/feature-name.feature.ts']);
            expect(getTopLevelConfig()).to.eql([
                '/public.config.ts',
                ['COM', { config: { topology: {}, contextMappings: { envA: 'b' } } }]
            ]);
        });

        it(`pick config from the url config param`, async () => {
            const entry = new EnvironmentEntryBuilder().buildDynamic({
                name: 'test',
                target: 'web',
                envFiles: new Set(['/feature-name.test.env.ts']),
                featureMapping: {
                    rootFeatureName: 'feature-name',
                    mapping: {
                        'feature-name': {
                            featureFilePath: '/feature-name.feature.ts',
                            configurations: {
                                public: '/public.config.ts',
                                public2: '/public2.config.ts'
                            },
                            context: {
                                envA: 'b'
                            }
                        }
                    },
                    bootstrapFeatures: []
                }
            });

            const { getRequireCalls, getRunningFeatures, getTopLevelConfig, moduleExports } = evalEntry(entry, {
                config: 'public2'
            });

            // Static calls
            expect(getRequireCalls()).to.eql(['/feature-name.test.env.ts', '@wixc3/engine-core']);

            await moduleExports.default;

            // Dynamic call to config
            expect(getRequireCalls()).to.eql([
                '/feature-name.test.env.ts',
                '@wixc3/engine-core',
                '/feature-name.feature.ts',
                '/public2.config.ts'
            ]);

            expect(getRunningFeatures()).to.eql(['/feature-name.feature.ts']);
            expect(getTopLevelConfig()).to.eql([
                '/public2.config.ts',
                ['COM', { config: { topology: {}, contextMappings: { envA: 'b' } } }]
            ]);
        });
    });
});
