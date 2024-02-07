import { OverrideConfigHook } from '@wixc3/engine-scripts';
import { BuildOptions, Plugin } from 'esbuild';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';
import { join } from 'node:path';
import { htmlPlugin } from './esbuild-html-plugin';
import { dynamicEntryPlugin } from './esbuild-dynamic-entry-plugin';
import { EntryPoints } from './create-entrypoints';

export interface CreateBuildConfigOptions {
    dev: boolean;
    buildPlugins: Plugin[] | OverrideConfigHook;
    publicPath: string;
    outputPath: string;
    buildConditions?: string[];
    extensions?: string[];
}

export function createBuildConfiguration(
    options: CreateBuildConfigOptions,
    { nodeEntryPoints, webEntryPoints }: EntryPoints,
    jsOutExtension: '.js' | '.mjs',
    nodeFormat: 'esm' | 'cjs',
) {
    const { dev, outputPath, publicPath, buildPlugins, buildConditions, extensions } = options;

    const commonPlugins = Array.isArray(buildPlugins) ? buildPlugins : [];

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        format: 'esm',
        publicPath,
        metafile: true,
        sourcemap: true,
        keepNames: true,
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
            dynamicEntryPlugin({ entryPoints: webEntryPoints, loader: 'js' }),
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
        plugins: [...commonConfig.plugins, dynamicEntryPlugin({ entryPoints: nodeEntryPoints, loader: 'js' })],
    } satisfies BuildOptions;

    if (typeof buildPlugins === 'function') {
        return buildPlugins({ webConfig, nodeConfig });
    }

    return {
        webConfig,
        nodeConfig,
    };
}
