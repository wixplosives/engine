import { nodeFs as fs } from '@file-services/node';
import { DISPOSE_OF_TEMP_DIRS, createTestDir } from '@wixc3/testing-node';
import { type SpawnSyncOptions } from 'node:child_process';
import { withFeature, type IFeatureExecutionOptions, type IWithFeatureOptions, spawnSyncSafe } from './with-feature.js';

export interface IWithLocalFixtureOptions extends IWithFeatureOptions {
    fixturePath?: string;
}

/**
 * @deprecated use `withFeature` with fixturePath instead.
 * 
 * Similar to `withFeature`, but creates a temp directory
 * and optionally copies a fixture to it as a "project".
 */
export function withLocalFixture(fullSuiteOptions: IWithLocalFixtureOptions) {
    /** we don't want to pass `fixturePath` to `withFeature` because it will kick in the new mechanism  */
    const { fixturePath: suiteFixturePath, ...suiteOptions } = fullSuiteOptions;
    const { getLoadedFeature: originalGetLoadedFeature, disposeAfter } = withFeature(suiteOptions);

    async function getLoadedFeature(testOptions: IWithLocalFixtureOptions = suiteOptions) {
        const { fixturePath = suiteFixturePath, runOptions = suiteOptions.runOptions } = testOptions;
        if (runOptions && runOptions.projectPath) {
            throw new Error(
                `runOptions["projectPath"] shouldn't be provided. It will get overridden by returned projectPath.`,
            );
        }

        const projectPath = createTestDir('local-test', undefined, (disposable) =>
            disposeAfter(disposable, {
                name: 'local fixture temp dir',
                group: DISPOSE_OF_TEMP_DIRS,
            }),
        );

        if (fixturePath) {
            await fs.promises.copyDirectory(fixturePath, projectPath);
        }

        return {
            projectPath,
            spawn: (command: string, args: string[] = [], spawnOptions: SpawnSyncOptions = {}) =>
                spawnSyncSafe(command, args, {
                    stdio: 'inherit',
                    cwd: projectPath,
                    shell: true,
                    ...spawnOptions,
                }),
            loadFeature: (options: IFeatureExecutionOptions = {}) =>
                originalGetLoadedFeature({ ...testOptions, runOptions: { ...runOptions, projectPath }, ...options }),
        };
    }
    return {
        getLoadedFeature,
    };
}
