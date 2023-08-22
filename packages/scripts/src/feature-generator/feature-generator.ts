import type { IFileSystem } from '@file-services/types';
import type { IGeneratorOptions } from './types.js';
import { mapDirectory, writeDirectoryContentsSync, enrichContext, readDirectoryContentsSync } from './utils.js';
import { templateCompilerProvider } from '@wixc3/common';

export const TEMPLATE_EXTENSION = '.tmpl';
export const DEFAULT_FEATURE_DIR_NAME_TEMPLATE = '${featureName.dashCase}';

export function generateFeature({
    fs,
    featureName,
    targetPath,
    templatesDirPath,
    featureDirNameTemplate = DEFAULT_FEATURE_DIR_NAME_TEMPLATE,
}: IGeneratorOptions) {
    const templatesDir = readDirectoryContentsSync(fs, templatesDirPath);
    const templateContext = enrichContext({ featureName });
    const templateCompiler = templateCompilerProvider(templateContext);
    const featureMapper = createFeatureMapper(templateCompiler);
    const featureDir = mapDirectory(templatesDir, featureMapper);
    const featureDirName = templateCompiler(featureDirNameTemplate);
    targetPath = fs.join(targetPath, featureDirName);
    writeDirectoryContentsSync(fs, featureDir, targetPath);
}

export const templateParser = (
    name: string,
    content: string | undefined,
    templateCompiler: (template: string) => string,
) => {
    if (!name.endsWith(TEMPLATE_EXTENSION)) {
        return { name, content };
    }

    const fileName = name.slice(0, name.length - TEMPLATE_EXTENSION.length);
    const mappedFileName = templateCompiler(fileName);

    return {
        name: mappedFileName,
        content: content ? templateCompiler(content) : undefined,
    };
};

const createFeatureMapper = (templateCompiler: (template: string) => string) => (name: string, content?: string) =>
    templateParser(name, content, templateCompiler);

/**
 * returns the path to features directory in the project
 * @param fs IFileSystem
 * @param path A general path in an project
 * @param featuresDir The features directory name (optional, if not used, returns `path` normalized)
 *
 * @example
 * ```
 * pathToFeaturesDirectory(fs, '/proj', 'packages');
 * // => '/proj/packages'
 *
 * pathToFeaturesDirectory(fs, '/proj/packages/some-feature', 'packages');
 * // => '/proj/packages'
 *
 * pathToFeaturesDirectory(fs, '/proj');
 * // => '/proj'
 * ```
 */
export const pathToFeaturesDirectory = (fs: IFileSystem, path: string, featuresDir?: string) => {
    if (!featuresDir) {
        return fs.normalize(path);
    }

    const normalizedFeaturesDir = fs.normalize(featuresDir);
    const normalizedPath = fs.normalize(path);

    const featuresDirIndex = normalizedPath.indexOf(normalizedFeaturesDir);
    if (featuresDirIndex !== -1) {
        return normalizedPath.slice(0, featuresDirIndex + normalizedFeaturesDir.length);
    } else {
        return fs.join(path, normalizedFeaturesDir);
    }
};
