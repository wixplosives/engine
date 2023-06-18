import type webpack from 'webpack';
import type { FoundFeatures } from '../analyze-feature';
import type { EngineConfig } from '../types';
import type { BuildOptions } from './defaults';
import type { ICompilerOptions } from './types';

export const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target as string} using webpack...`);



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
    publicPathVariableName: opts.publicPathVariableName,
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
