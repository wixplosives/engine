import { createMemoryFs } from '@file-services/memory';
import { expect } from 'chai';
import { FeatureLocator } from '../src/engine-utils/feature-locator';

describe('FeatureLocator', () => {
    it('locate feature inside fixture', () => {
        const fs = createMemoryFs({
            fixtures: {
                'my-thing.feature.ts': ``,
                'my-config.config.ts': ``
            }
        });

        const results = new FeatureLocator('/', fs).findFeaturesInFolder('fixtures');

        expect(results).to.eql([
            {
                features: ['/fixtures/my-thing.feature.ts'],
                configurations: ['/fixtures/my-config.config.ts'],
                envs: [],
                contexts: []
            }
        ]);
    });
    it('locate all features in fixtures folder', () => {
        const fs = createMemoryFs({
            fixtures: {
                'my-thing.feature.ts': ``,
                'my-config.config.ts': ``,
                feature1: {
                    'feature1.feature.ts': ``,
                    'feature1-config.config.ts': ``
                }
            }
        });

        const results = new FeatureLocator('/', fs).findFeaturesInFolder('fixtures');

        expect(results).to.eql([
            {
                features: ['/fixtures/my-thing.feature.ts'],
                configurations: ['/fixtures/my-config.config.ts'],
                envs: [],
                contexts: []
            },
            {
                features: ['/fixtures/feature1/feature1.feature.ts'],
                configurations: ['/fixtures/feature1/feature1-config.config.ts'],
                envs: [],
                contexts: []
            }
        ]);
    });

    it('locates feature in "feature" folder', () => {
        const fs = createMemoryFs({
            feature: {
                'test-feature.feature.ts': ``
            }
        });

        const { rootFeatureName } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(rootFeatureName).to.eql('test-feature');
    });

    it('one feature set at folder root', () => {
        const fs = createMemoryFs({
            fixtures: {
                'fixture.feature.ts': ``,
                'fixture.main.env.ts': ``,
                'fixture.test.env.ts': ``,
                'fixture-x.config.ts': ``,
                'fixture-y.config.ts': ``
            },
            src: {
                'test-feature.feature.ts': ``
            }
        });

        const { mapping } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(mapping).to.eql({
            fixture: {
                configurations: {
                    'fixture-x': '/fixtures/fixture-x.config.ts',
                    'fixture-y': '/fixtures/fixture-y.config.ts'
                },
                featureFilePath: '/fixtures/fixture.feature.ts',
                context: {},
                flags: {}
            }
        });
    });

    it('two feature sets at folder root', () => {
        const fs = createMemoryFs({
            fixtures: {
                'fixture.feature.ts': ``,
                'fixture.main.env.ts': ``,
                'fixture.test.env.ts': ``,
                'fixture-x.config.ts': ``,
                'fixture-y.config.ts': ``,

                'fixture2.feature.ts': ``,
                'fixture2.main.env.ts': ``,
                'fixture2.test.env.ts': ``
            },
            src: {
                'test-feature.feature.ts': ``
            }
        });

        const { mapping } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(mapping).to.eql({
            fixture: {
                configurations: {
                    'fixture-x': '/fixtures/fixture-x.config.ts',
                    'fixture-y': '/fixtures/fixture-y.config.ts'
                },
                featureFilePath: '/fixtures/fixture.feature.ts',
                context: {},
                flags: {}
            },
            fixture2: {
                configurations: {
                    'fixture-x': '/fixtures/fixture-x.config.ts',
                    'fixture-y': '/fixtures/fixture-y.config.ts'
                },
                featureFilePath: '/fixtures/fixture2.feature.ts',
                context: {},
                flags: {}
            }
        });
    });
    it('one at the root and one inside inner folder', () => {
        const fs = createMemoryFs({
            fixtures: {
                'fixture.feature.ts': ``,
                'fixture.main.env.ts': ``,
                'fixture.test.env.ts': ``,
                'fixture-x.config.ts': ``,
                'fixture-y.config.ts': ``,
                inner: {
                    'fixture2.feature.ts': ``,
                    'fixture2.main.env.ts': ``,
                    'fixture2.test.env.ts': ``,
                    'inner-fixture2-x.config.ts': ``,
                    'inner-fixture2-y.config.ts': ``
                }
            },
            src: {
                'test-feature.feature.ts': ``
            }
        });

        const { mapping } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(mapping).to.eql({
            fixture: {
                configurations: {
                    'fixture-x': '/fixtures/fixture-x.config.ts',
                    'fixture-y': '/fixtures/fixture-y.config.ts'
                },
                featureFilePath: '/fixtures/fixture.feature.ts',
                context: {},
                flags: {}
            },
            fixture2: {
                configurations: {
                    'inner-fixture2-x': '/fixtures/inner/inner-fixture2-x.config.ts',
                    'inner-fixture2-y': '/fixtures/inner/inner-fixture2-y.config.ts'
                },
                featureFilePath: '/fixtures/inner/fixture2.feature.ts',
                context: {},
                flags: {}
            }
        });
    });

    it('only configs', () => {
        const fs = createMemoryFs({
            fixtures: {
                'fixture-x.config.ts': ``,
                'fixture-y.config.ts': ``
            },
            src: {
                'test-feature.feature.ts': ``
            }
        });

        const { mapping } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(mapping).to.eql({
            'test-feature': {
                configurations: {
                    'fixture-x': '/fixtures/fixture-x.config.ts',
                    'fixture-y': '/fixtures/fixture-y.config.ts'
                },
                featureFilePath: '/src/test-feature.feature.ts',
                context: {},
                flags: {}
            }
        });
    });

    it('create a map of single features and possible configurations', () => {
        const fs = createMemoryFs({
            fixtures: {
                'my-thing.feature.ts': ``,
                'my-config.config.ts': ``,
                feature1: {
                    'feature1.feature.ts': ``,
                    'feature1-config.config.ts': ``
                },
                feature2: {
                    'feature2-config.config.ts': ``
                }
            },
            src: {
                'package.feature.ts': ``
            }
        });

        const { mapping } = new FeatureLocator('/', fs).createFeatureMapping();

        expect(mapping).to.eql({
            feature1: {
                configurations: {
                    'feature1-config': '/fixtures/feature1/feature1-config.config.ts'
                },
                featureFilePath: '/fixtures/feature1/feature1.feature.ts',
                context: {},
                flags: {}
            },
            'my-thing': {
                configurations: {
                    'my-config': '/fixtures/my-config.config.ts'
                },
                featureFilePath: '/fixtures/my-thing.feature.ts',
                context: {},
                flags: {}
            },
            package: {
                configurations: {
                    'feature2-config': '/fixtures/feature2/feature2-config.config.ts'
                },
                featureFilePath: '/src/package.feature.ts',
                context: {},
                flags: {}
            }
        });
    });
});
