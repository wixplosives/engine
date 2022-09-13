const fs = require('fs');
const { join } = require('path');

const componentsPath = './packages/dashboard/src/components';
const componentsDirectory = join(__dirname, componentsPath);
const directories = fs.readdirSync(componentsDirectory, { withFileTypes: true });
const mappedComponents = directories.reduce((acc, dirnet) => {
    const { name } = dirnet;
    if (dirnet.isDirectory() && name !== 'icons') {
        const componentFileAbsolutePath = join(componentsDirectory, name, `${name}.tsx`);
        const componentName = name
            .split('-')
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join('');
        acc[componentFileAbsolutePath] = {
            [componentName]: {
                request: '@wixc3/wcs-components',
                exportName: componentName,
            },
        };
    }
    return acc;
}, {});

/**@type {import('./packages/build-simulation/src/universal').ComponentPathsMapping} */
const componentPathsMapping = (request, exportName) => mappedComponents[request]?.[exportName];

module.exports = {
    newComponent: {
        componentsPath,
        templatesPath: 'packages/dashboard/src/component-templates',
    },
    // styleFilesConfig: {
    //     commonStyleFilePattern: '{projectPath}/**/global.css',
    // },
    // componentsDiscovery: {
    //     include: [
    //         'packages/dashboard/src/**',
    //         // 'packages/code-views/src/main/components/visualizers/**',
    //         // 'packages/boards-panel/src/**',
    //         // 'packages/computed-styles/src/**',
    //         // 'packages/editing/src/**',
    //         // 'packages/file-components/src/**',
    //         // 'packages/git-ui/src/main/components/**',
    //         // 'packages/gui/src/**',
    //         // 'packages/home-screen/src/**',
    //         // 'packages/wcs-prerequisites-installer/src/**',
    //         // 'packages/project-picker/src/**',
    //         // 'packages/new-component/src/**',
    //         // 'packages/simulation-code-editor/src/**',
    //         // 'packages/simulation-edit-view/src/**',
    //         // 'packages/simulation-log/src/**',
    //         // 'packages/simulation-props-editor/src/**',
    //         // 'packages/style-panel/src/**',
    //         // 'packages/wcs-components/src/**',
    //         // 'packages/wix-answers/src/**',
    //         // 'packages/subscription/src/**',
    //         // 'packages/drag-on-stage/src/**',
    //         // 'packages/stage-grid-indications/src/main/components/**',
    //     ],
    //     exclude: ['**/test/**', '**/test-kit/**', '**/fixtures/**'],
    // },
    boardsPath: 'packages/dashboard/src/_wcs/boards',
    // boardGlobalSetup: './packages/wcs-components/src/_wcs/board-global-setup.ts',
    // staticDeploy: {
    //     include: ['./tsconfig.json'],
    // },
    scripts: {
        install: {
            title: 'Install',
            description: 'Run install',
            command: 'yarn',
        },
        // buildQuick: {
        //     title: 'Build Quickly',
        //     description: 'Quickly build component-studio',
        //     command: 'yarn build:quick',
        // },
        // commonUpdate: {
        //     title: 'Install & Build Quickly',
        //     description: 'Run install & quickly build component-studio',
        //     run: ['install', 'buildQuick'],
        //     trigger: ['checkout', 'pull', 'setup'],
        // },
        clean: {
            title: 'Clean',
            description: 'Cleaning installed packages and un-staged changes',
            command: 'git clean -fdx',
        },
        reset: {
            title: 'Reset',
            description: 'Cleaning the repository and installing packages',
            run: ['clean', 'install'],
        },
    },
    componentPathsMapping,
    resolve: {
        workspaceAlias: {
            './dist/*': './src/*',
            './*': './src/*',
        },
    },
};
