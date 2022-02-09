import fs from '@file-services/node';
import { loadFeaturesFromPackages, EngineConfig, ENGINE_CONFIG_FILE_NAME } from '@wixc3/engine-scripts';
import { resolveDirectoryContext, childPackagesFromContext } from '@wixc3/resolve-directory-context';

export function findFeatures(
    initialDirectoryPath: string,
    featureDiscoveryRoot = '.'
): ReturnType<typeof loadFeaturesFromPackages> {
    const packagePath = fs.findClosestFileSync(initialDirectoryPath, 'package.json');
    if (!packagePath) {
        throw new Error(`Couldn't find package.json relative to ${initialDirectoryPath}`);
    }
    const packages = childPackagesFromContext(resolveDirectoryContext(packagePath));
    return loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
}

export async function getEngineConfig(basePath: string): Promise<EngineConfig | undefined> {
    const engineConfigFilePath = await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME);
    if (engineConfigFilePath) {
        try {
            return (await import(engineConfigFilePath)) as EngineConfig;
        } catch (err) {
            throw new Error(`failed evaluating config file: ${engineConfigFilePath} ${String(err)}`);
        }
    }
    return undefined;
}
