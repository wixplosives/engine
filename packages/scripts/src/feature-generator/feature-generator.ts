import { IFileSystem } from '@file-services/types';
import { IGeneratorOptions, IEnrichedTemplateContext } from './types';
import { mapDirectory, writeDirectoryContentsSync, enrichContext, readDirectoryContentsSync } from './utils';
import { compileTemplate } from '../utils';

export const TEMPLATE_EXTENSION = '.tmpl';
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
    const templatesDir = readDirectoryContentsSync(fs, templatesDirPath);
    const templateContext = enrichContext({ featureName });
    const featureMapper = createFeatureMapper(templateContext);
    const featureDir = mapDirectory(templatesDir, featureMapper);
    const featureDirName = compileTemplate(featureDirNameTemplate)(templateContext);
    targetPath = fs.join(targetPath, featureDirName);
    writeDirectoryContentsSync(fs, featureDir, targetPath);
}

export const templateParser = (name: string, content: string | undefined, context: IEnrichedTemplateContext) => {
    if (!name.endsWith(TEMPLATE_EXTENSION)) {
        return { name, content };
    }

    const fileName = name.slice(0, name.length - TEMPLATE_EXTENSION.length);
    const mappedFileName = compileTemplate(fileName)(context);

    return {
        name: mappedFileName,
        content: content ? compileTemplate(content)(context) : undefined
    };
};

const createFeatureMapper = (context: IEnrichedTemplateContext) => (name: string, content?: string) =>
    templateParser(name, content, context);

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
