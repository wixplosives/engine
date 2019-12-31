import { NodePlopAPI, ActionType } from 'plop';
import kebabCase from 'lodash/kebabCase';
import fs from '@file-services/node';

export default function(plop: NodePlopAPI) {
    plop.setGenerator('feature', {
        description: 'Generate new feature',
        prompts: [
            {
                type: 'input',
                name: 'featureName',
                message: 'What is your feature name?',
                validate: name => !!name.length
            },
            {
                type: 'input',
                name: 'featurLocation',
                message: 'Where do you want it?',
                default: './'
            },
            {
                type: 'confirm',
                name: 'hasConfig',
                message: 'Does your feature have a config?',
                default: false
            },
            {
                type: 'confirm',
                name: 'hasFixture',
                message: 'Do you want a fixture?',
                default: true
            },
            {
                type: 'input',
                name: 'fixtureName',
                message: 'What is the fixture name?',
                when: data => data.hasFixture,
                default: (data: any) => 'test-' + kebabCase(data.featureName)
            },
            {
                type: 'confirm',
                name: 'keepPackageName',
                message: (data: any) => 'Your package name will be: ' + kebabCase(data.featureName) + '-feature. OK?',
                default: true
            },
            {
                type: 'input',
                name: 'packageName',
                message: 'Enter package name:',
                when: data => !data.keepPackageName,
                default: (data: any) => kebabCase(data.featureName) + '-feature'
            }
        ],
        actions: ((data: any) => {
            const baseDir = fs.join(data.featurLocation, '{{dashCase featureName}}');
            const actions: ActionType<object>[] = [];

            // feature/[feature-name].feature.ts
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'feature/{{dashCase featureName}}.feature.ts'),
                templateFile: 'templates/feature/feature-template.feature.ts.hbs'
            } as any);

            // feature/index.ts
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'feature/index.ts'),
                templateFile: 'templates/feature/index.ts.hbs'
            } as any);

            if (data.hasConfig) {
                // fixtures/example-[feature-name].config.ts
                actions.push({
                    type: 'add',
                    path: fs.join(baseDir, 'fixtures/example-{{dashCase featureName}}.config.ts'),
                    templateFile: 'templates/fixtures/example.config.ts.hbs'
                } as any);
            }

            if (data.hasFixture) {
                // fixtures/[fixture-name]/test-[fixture-name].feature.ts
                actions.push({
                    type: 'add',
                    path: fs.join(baseDir, 'fixtures/{{dashCase fixtureName}}/{{dashCase fixtureName}}.feature.ts'),
                    templateFile: 'templates/fixtures/test-feature/test-feature.feature.ts.hbs'
                } as any);
            }

            // test/[feature-name].spec.tsx
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'test/{{dashCase featureName}}.spec.tsx'),
                templateFile: 'templates/test/feature-template.spec.tsx.hbs'
            } as any);

            // test/[feature-name].ix.ts
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'test/{{dashCase featureName}}.ix.ts'),
                templateFile: 'templates/test/feature-template.ix.ts.hbs'
            } as any);

            // test-kit/index.ts
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'test-kit/index.ts'),
                templateFile: 'templates/test-kit/index.ts.hbs'
            } as any);

            // package.json
            actions.push({
                type: 'add',
                path: fs.join(baseDir, 'package.json'),
                templateFile: 'templates/package.json.hbs'
            } as any);

            return actions;
        }) as any
    });
}
