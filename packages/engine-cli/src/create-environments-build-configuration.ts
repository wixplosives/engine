import { OverrideConfigHook } from '@wixc3/engine-scripts';
import { BuildOptions, Plugin } from 'esbuild';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';
import { join } from 'node:path';
import { htmlPlugin } from './esbuild-html-plugin';
import { dynamicEntryPlugin } from './esbuild-dynamic-entry-plugin';
import { EntryPoints, EntryPointsPaths } from './create-entrypoints';

export interface CreateBuildConfigOptions {
    dev: boolean;
    buildPlugins: Plugin[] | OverrideConfigHook;
    publicPath: string;
    outputPath: string;
    buildConditions?: string[];
    extensions?: string[];
    entryPoints: EntryPoints;
    jsOutExtension: '.js' | '.mjs';
    nodeFormat: 'esm' | 'cjs';
    entryPointsPaths?: EntryPointsPaths;
}

export function createBuildConfiguration(options: CreateBuildConfigOptions) {
    const {
        dev,
        outputPath,
        publicPath,
        buildPlugins,
        buildConditions,
        extensions,
        entryPoints,
        jsOutExtension,
        nodeFormat,
        entryPointsPaths,
    } = options;
    const { webEntryPoints, nodeEntryPoints } = entryPoints;
    const { webEntryPointsPaths, nodeEntryPointsPaths } = entryPointsPaths || {};

    const commonPlugins = Array.isArray(buildPlugins) ? buildPlugins : [];

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        /*
            using iife here because esm makes debugging very slow to pickup variables in scope.
            if one want to change this to esm, make sure that some bundle splitting is happening.
        */
        format: 'iife',
        publicPath,
        metafile: true,
        sourcemap: true,
        keepNames: true,
        treeShaking: true,
        conditions: buildConditions,
        resolveExtensions: extensions,
        outExtension: { '.js': jsOutExtension },
        loader: {
            '.json': 'json',
            '.png': 'file',
            '.jpeg': 'file',
            '.jpg': 'file',
            '.svg': 'file',
            '.woff': 'file',
            '.woff2': 'file',
            '.ttf': 'file',
        },
        plugins: [...commonPlugins, topLevelConfigPlugin({ emit: !dev })],
    } satisfies BuildOptions;

    const webConfig = {
        ...commonConfig,
        platform: 'browser',
        outdir: join(outputPath, 'web'),
        banner: {
            js: `globalThis.__webpack_public_path__ = ${JSON.stringify(
                publicPath,
            )};\nglobalThis.process={env:{}};globalThis.DEFAULT_WORKER_TYPE = 'module';`,
        },
        plugins: [
            ...commonConfig.plugins,
            dynamicEntryPlugin({
                virtualEntryPoints: webEntryPoints,
                loader: 'js',
                entryPointsOnDisk: webEntryPointsPaths,
            }),
            htmlPlugin({
                toHtmlPath(key) {
                    const entry = webEntryPoints.get(key);
                    if (!entry) {
                        throw new Error(`Could not find entrypoint for ${key} in ${[...webEntryPoints.keys()]}}`);
                    }
                    const [envName] = key.split('.');
                    return `${envName}.html`;
                },
            }),
        ],
    } satisfies BuildOptions;

    const nodeConfig = {
        ...commonConfig,
        platform: 'node',
        format: nodeFormat,
        outdir: join(outputPath, 'node'),
        plugins: [
            ...commonConfig.plugins,
            dynamicEntryPlugin({
                virtualEntryPoints: nodeEntryPoints,
                loader: 'js',
                entryPointsOnDisk: nodeEntryPointsPaths,
            }),
        ],
    } satisfies BuildOptions;

    if (typeof buildPlugins === 'function') {
        return buildPlugins({ webConfig, nodeConfig });
    }

    return {
        webConfig,
        nodeConfig,
    };
}
