import type { INpmPackage } from '@wixc3/resolve-directory-context';
import type { IFileSystemSync } from '@file-services/types';
import { isFeatureFile } from '../build-constants';
import { loadFeaturesFromPaths } from './analyze-feature';

const featureRoots = ['.', 'feature', 'fixtures'] as const;

export function loadFeaturesFromPackages(npmPackages: INpmPackage[], fs: IFileSystemSync, featureDiscoveryRoot = '.') {
    const ownFeatureFilePaths = new Set<string>();
    const ownFeatureDirectoryPaths = new Set<string>();

    // pick up own feature files in provided npm packages
    for (const { directoryPath } of npmPackages) {
        for (const rootName of featureRoots) {
            const rootPath = fs.join(directoryPath, featureDiscoveryRoot, rootName);
            if (!fs.directoryExistsSync(rootPath)) {
                continue;
            }
            ownFeatureDirectoryPaths.add(rootPath);
            for (const rootItem of fs.readdirSync(rootPath, { withFileTypes: true })) {
                const itemPath = fs.join(rootPath, rootItem.name);
                if (rootItem.isFile()) {
                    const itemName = rootItem.name;
                    if (isFeatureFile(itemName)) {
                        ownFeatureFilePaths.add(itemPath);
                    }
                } else if (rootName === 'fixtures' && rootItem.isDirectory()) {
                    ownFeatureDirectoryPaths.add(itemPath);
                    for (const subFixtureItem of fs.readdirSync(itemPath, { withFileTypes: true })) {
                        const subFixtureItemPath = fs.join(itemPath, subFixtureItem.name);
                        const itemName = subFixtureItem.name;
                        if (subFixtureItem.isFile() && isFeatureFile(itemName)) {
                            ownFeatureFilePaths.add(subFixtureItemPath);
                        }
                    }
                }
            }
        }
    }
    return loadFeaturesFromPaths(ownFeatureFilePaths, ownFeatureDirectoryPaths, fs);
}
