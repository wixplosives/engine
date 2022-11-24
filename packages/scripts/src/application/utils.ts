import type { IEnvironmentDescriptor } from '@wixc3/engine-runtime-node';
import fs from '@file-services/node';
import type webpack from 'webpack';
import type { AnyEnvironment } from '@wixc3/engine-core';
import type { IBuildCommandOptions, ICompilerOptions } from './types';
import { getResolvedEnvironments as resolveEnvironments } from '../utils';
import type { EngineConfig, IFeatureDefinition } from '../types';
import type { BuildOptions } from './defaults';
import type { FoundFeatures } from '../analyze-feature';

export const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target as string} using webpack...`);

export function addEnvEntrypoints(
    envs: Iterable<string>,
    target: 'node' | 'web' | 'webworker' | 'electron-renderer',
    entryPoints: Record<string, Record<string, string>>,
    outDir: string
) {
    for (const envName of envs) {
        entryPoints[envName] = {
            ...entryPoints[envName],
            [target]: fs.posix.join(outDir, `${envName}.${target}.js`),
        };
    }
}

export function getExportedEnvironments(
    features: Map<string, { exportedEnvs: IEnvironmentDescriptor<AnyEnvironment>[] }>
): Set<IEnvironmentDescriptor> {
    const environments = new Set<IEnvironmentDescriptor>();
    for (const { exportedEnvs } of features.values()) {
        for (const exportedEnv of exportedEnvs) {
            environments.add(exportedEnv);
        }
    }
    return environments;
}

export function hookCompilerToConsole(compiler: webpack.MultiCompiler): void {
    compiler.hooks.run.tap('engine-scripts', bundleStartMessage);
    compiler.hooks.watchRun.tap('engine-scripts', bundleStartMessage);

    compiler.hooks.done.tap('engine-scripts stats printing', ({ stats }) => {
        for (const childStats of stats) {
            if (childStats.hasErrors() || childStats.hasWarnings()) {
                console.log(childStats.toString('errors-warnings'));
            }
        }
    });
}

export const getResolvedEnvironments = (options: IBuildCommandOptions, features: Map<string, IFeatureDefinition>) =>
    resolveEnvironments({
        featureName: options.featureName,
        features,
        filterContexts: options.singleFeature,
        environments: [...getExportedEnvironments(features)],
    });

export const toCompilerOptions = (
    opts: BuildOptions,
    analyzed: FoundFeatures,
    config: EngineConfig,
    environments: ICompilerOptions['environments']
): ICompilerOptions => ({
    ...analyzed,
    environments,
    mode: opts.mode,
    favicon: opts.favicon ?? config.favicon,
    featureName: opts.featureName,
    configName: opts.configName,
    publicPath: opts.publicPath,
    title: opts.title,
    staticBuild: opts.staticBuild,
    publicConfigsRoute: opts.publicConfigsRoute,
    overrideConfig: opts.overrideConfig,
    singleFeature: opts.singleFeature,
    // whether should fetch at runtime for the external features metadata
    webpackConfigPath: opts.webpackConfigPath,
    eagerEntrypoint: opts.eagerEntrypoint,
    configLoaderModuleName: opts.configLoaderModuleName,
});

export const compile = (compiler: webpack.MultiCompiler) =>
    new Promise<webpack.MultiStats>((resolve, reject) =>
        compiler.run((e, s) => {
            if (e) {
                reject(e);
            } else if (s!.hasErrors()) {
                reject(new Error(s!.toString('errors-warnings')));
            } else {
                resolve(s!);
            }
        })
    );
