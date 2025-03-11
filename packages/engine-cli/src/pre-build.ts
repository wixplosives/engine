import esbuild from 'esbuild';
import path from 'node:path';
import { BuildConfiguration } from './types.js';
import { shouldBuildNode, shouldBuildWeb } from './engine-build.js';

export async function runPreBuilds(
    rootDir: string,
    preBuildsPaths: string[],
    buildConfiguration: BuildConfiguration,
    buildTargets: 'node' | 'web' | 'both' | 'electron',
    verbose = false,
): Promise<void> {
    if (!preBuildsPaths.length) {
        return;
    }

    console.log(`Running ${preBuildsPaths.length} pre-builds before main build...`);

    const entryPoints = preBuildsPaths.map((entryPath) => path.resolve(rootDir, entryPath));

    if (shouldBuildNode(buildTargets)) {
        if (verbose) {
            console.log(`Building ${preBuildsPaths.length} files to ${buildConfiguration.webConfig.outdir}`);
        }
        const { plugins: _plugins, ...configWithoutPlugins } = buildConfiguration.nodeConfig;
        const baseConfig: esbuild.BuildOptions = {
            entryPoints,
            ...configWithoutPlugins,
        };

        await esbuild.build(baseConfig);
    }

    if (shouldBuildWeb(buildTargets)) {
        if (verbose) {
            console.log(`Building ${preBuildsPaths.length} files to ${buildConfiguration.webConfig.outdir}`);
        }
        const { plugins: _plugins, ...configWithoutPlugins } = buildConfiguration.webConfig;
        const baseConfig: esbuild.BuildOptions = {
            entryPoints,
            ...configWithoutPlugins,
        };

        await esbuild.build(baseConfig);
    }

    if (verbose) {
        console.log(`Pre-build completed successfully`);
    }
}
