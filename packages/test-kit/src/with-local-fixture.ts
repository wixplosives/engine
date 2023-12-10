import { nodeFs as fs } from '@file-services/node';
import { createTestDir, DISPOSE_OF_TEMP_DIRS } from '@wixc3/testing-node';
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { withFeature, type IFeatureExecutionOptions, type IWithFeatureOptions } from './with-feature.js';

export interface IWithLocalFixtureOptions extends IWithFeatureOptions {
    fixturePath?: string;
}

/**
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

const spawnSyncSafe = ((...args: Parameters<typeof spawnSync>) => {
    const spawnResult = spawnSync(...args);
    if (spawnResult.status !== 0) {
        throw new Error(
            `Command "${args.filter((arg) => typeof arg === 'string').join(' ')}" failed with exit code ${
                spawnResult.status ?? 'null'
            }.`,
        );
    }
    return spawnResult;
}) as typeof spawnSync;
