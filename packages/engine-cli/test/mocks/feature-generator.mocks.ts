export const templatesDirContents = {
    feature: {
        '${featureName.dashCase}.feature.ts.tmpl': 'export function ${featureName.pascalCase}Feature() {}',
    },
    fixtures: {
        '${featureName.dashCase}-test.tmpl': {
            '${featureName.dashCase}-test.feature.ts.tmpl': 'export function ${featureName.pascalCase}TestFeature() {}',
        },
    },
    'index.ts.tmpl': "export * from './feature/${featureName.dashCase}.feature.ts'",
    'const-file.txt': 'no change here: ${featureName.dashCase}',
    'README.md.tmpl': 'This is readme for ${featureName.camelCase}',
};

export const FEATURE_NAME = 'Cool-thing';

export const expectedDirContents = {
    'cool-thing': {
        feature: {
            'cool-thing.feature.ts': 'export function CoolThingFeature() {}',
        },
        fixtures: {
            'cool-thing-test': {
                'cool-thing-test.feature.ts': 'export function CoolThingTestFeature() {}',
            },
        },
        'index.ts': "export * from './feature/cool-thing.feature.ts'",
        'const-file.txt': 'no change here: ${featureName.dashCase}',
        'README.md': 'This is readme for coolThing',
    },
};
