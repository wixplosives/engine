import esbuild from 'esbuild';
import path from 'node:path';
import { BuildConfiguration, PreBuildConfig } from './types.js';

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

        // Resolve entry points relative to rootDir
        const entryPoints = paths.map((entryPath) => path.resolve(rootDir, entryPath));

        await esbuild.build({
            entryPoints,
            outdir: outputDir,
            bundle: true,
            format: 'iife',
            target: 'es2022',
            minify: !dev,
            sourcemap: dev,
            logLevel: verbose ? 'info' : 'warning',
            color: true,
            legalComments: 'none',
            loader: {
                '.ttf': 'file',
                '.woff': 'file',
                '.woff2': 'file',
            },
        });

        if (verbose) {
            console.log(`Pre-build "${distName}" completed successfully`);
        }
    }
}
