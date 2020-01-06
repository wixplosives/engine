import { IFileSystem } from '@file-services/types';
import { IGeneratorOptions } from './types';
import { mapDirectory, writeDirectorySync, enrichContext, readDirectorySync } from './utils';
import { compileTemplate } from '../utils/string-utils';

export const TEMPLATE_EXTENSION = '.tmpl';
export const TARGET_PATH = '/packages';
export const DEFAULT_FEATURE_DIR_NAME_TEMPLATE = '${featureName.dashCase}';

export default function generateFeature(
    fs: IFileSystem,
    {
        featureName,
        targetPath,
        templatesDirPath,
        featureDirNameTemplate = DEFAULT_FEATURE_DIR_NAME_TEMPLATE
    }: IGeneratorOptions
) {
    const templatesDir = readDirectorySync(fs, templatesDirPath);
    const context = enrichContext({ featureName });
    const mapper = createFeatureMapper(context);
    const featureDir = mapDirectory(templatesDir, mapper);
    const featureDirName = compileTemplate(featureDirNameTemplate)(context);
    targetPath = fs.join(targetPath, featureDirName);
    writeDirectorySync(fs, featureDir, targetPath);
}

export const mapper = (name: string, content: string | undefined, context: object) => {
    if (!name.endsWith(TEMPLATE_EXTENSION)) {
        return { name, content };
    }
    name = name.slice(0, name.length - TEMPLATE_EXTENSION.length);
    const nameTemplate = compileTemplate(name);
    const mappedName = nameTemplate(context);

    return typeof content === 'string'
        ? { name: mappedName, content: compileTemplate(content)(context) }
        : { name: mappedName };
};

const createFeatureMapper = (context: object) => (name: string, content?: string) => mapper(name, content, context);

const PACKAGES_DIR = '/packages';
/**
 * returns the path to `packages` folder in the project
 * @param fs IFileSystem
 * @param path A general path in an project
 * @example
 * pathToPackagesPath('./proj/packages/some-package')
 * // => './proj/packages'
 * pathToPackagesPath('./proj')
 * // => './proj/packages'
 */
export const pathToPackagesPath = (fs: IFileSystem, path: string) => {
    const normalizedPackagesDir = fs.normalize(PACKAGES_DIR);
    const normalizedPath = fs.normalize(path);

    const packagesIndex = normalizedPath.indexOf(normalizedPackagesDir);
    if (packagesIndex !== -1) {
        return normalizedPath.slice(0, packagesIndex + normalizedPackagesDir.length);
    } else {
        return fs.join(path, normalizedPackagesDir);
    }
};
