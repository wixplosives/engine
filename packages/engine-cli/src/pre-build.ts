import esbuild from 'esbuild';
import path from 'node:path';
import { BuildConfiguration, PreBuildConfig } from './types.js';
import { shouldBuildNode, shouldBuildWeb } from './engine-build.js';

export async function runPreBuilds(
    rootDir: string,
    outputPath: string,
    preBuilds: PreBuildConfig[],
    dev: boolean,
    buildConfiguration: BuildConfiguration,
    buildTargets: 'node' | 'web' | 'both' | 'electron',
    verbose = false,
): Promise<void> {
    if (!preBuilds.length) {
        return;
    }

    if (verbose) {
        console.log(`Running ${preBuilds.length} pre-builds before main build...`);
    }

    for (const preBuild of preBuilds) {
        const { distName, paths } = preBuild;
        if (!paths.length) {
            continue;
        }

        const outputDir = path.join(outputPath, distName);

        if (verbose) {
            console.log(`Building ${paths.length} files to ${outputDir}`);
        }

        const entryPoints = paths.map((entryPath) => path.resolve(rootDir, entryPath));

        if (shouldBuildNode(buildTargets)) {
            const { plugins: _plugins, ...configWithoutPlugins } = buildConfiguration.nodeConfig;
            const baseConfig: esbuild.BuildOptions = {
                entryPoints,
                outdir: outputDir,
                ...configWithoutPlugins,
            };

            await esbuild.build(baseConfig);
        }

        if (shouldBuildWeb(buildTargets)) {
            const { plugins: _plugins, ...configWithoutPlugins } = buildConfiguration.webConfig;
            const baseConfig: esbuild.BuildOptions = {
                entryPoints,
                outdir: outputDir,
                ...configWithoutPlugins,
            };

            await esbuild.build(baseConfig);
        }

        if (verbose) {
            console.log(`Pre-build "${distName}" completed successfully`);
        }
    }
}
