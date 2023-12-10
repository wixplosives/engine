import { nodeFs as fs } from '@file-services/node';
import { createTestDir } from '@wixc3/testing-node';
import { type SpawnSyncOptions } from 'node:child_process';
import {
    withFeature,
    type IFeatureExecutionOptions,
    type IWithFeatureOptions,
    FINALE,
    spawnSyncSafe,
} from './with-feature.js';

export interface IWithLocalFixtureOptions extends IWithFeatureOptions {
    fixturePath?: string;
}

/**
 * @deprecated use `withFixture` with fixturePath instead.
 * Similar to `withFeature`, but creates a temp directory
 * and optionally copies a fixture to it as a "project".
 */
export function withLocalFixture(suiteOptions: IWithLocalFixtureOptions) {
    const { getLoadedFeature: originalGetLoadedFeature, disposeAfter } = withFeature(suiteOptions);

    async function getLoadedFeature(testOptions: IWithLocalFixtureOptions = suiteOptions) {
        const { fixturePath = suiteOptions.fixturePath, runOptions = suiteOptions.runOptions } = testOptions;
        if (runOptions && runOptions.projectPath) {
            throw new Error(
                `runOptions["projectPath"] shouldn't be provided. It will get overridden by returned projectPath.`,
            );
        }

        const projectPath = createTestDir('local-test', FINALE, disposeAfter);

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
