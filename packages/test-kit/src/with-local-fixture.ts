import { spawnSync, SpawnSyncOptions } from 'child_process';
import fs from '@file-services/node';
import { IFeatureExecutionOptions, IWithFeatureOptions, withFeature } from './with-feature';
import { createTempDirectorySync } from 'create-temp-directory';
import { disposeAfter } from '@wixc3/testing';

export interface IWithLocalFixtureOptions extends IWithFeatureOptions {
    fixturePath?: string;
}

/**
 * Similar to `withFeature`, but creates a temp directory
 * and optionally copies a fixture to it as a "project".
 */
export function withLocalFixture(suiteOptions: IWithLocalFixtureOptions) {
    const { getLoadedFeature: originalGetLoadedFeature } = withFeature(suiteOptions);

    async function getLoadedFeature(testOptions: IWithLocalFixtureOptions = suiteOptions) {
        const { fixturePath = suiteOptions.fixturePath, runOptions = suiteOptions.runOptions } = testOptions;
        if (runOptions && runOptions.projectPath) {
            throw new Error(
                `runOptions["projectPath"] shouldn't be provided. It will get overriden by returned projectPath.`
            );
        }

        const { path: projectPath, remove } = createTempDirectorySync('local-test');
        const { persist } = testOptions;
        if (persist) {
            after(() => remove());
        } else {
            disposeAfter(() => remove());
        }

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
            }.`
        );
    }
    return spawnResult;
}) as typeof spawnSync;
