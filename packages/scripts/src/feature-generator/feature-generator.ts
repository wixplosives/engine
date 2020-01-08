import { IFileSystem } from '@file-services/types';
import { IGeneratorOptions, IEnrichedTemplateContext } from './types';
import { mapDirectory, writeDirectoryContentsSync, enrichContext, readDirectoryContentsSync } from './utils';
import { compileTemplate } from '../utils';

export const TEMPLATE_EXTENSION = '.tmpl';
export const DEFAULT_FEATURE_DIR_NAME_TEMPLATE = '${featureName.dashCase}';

export default function generateFeature({
    fs,
    featureName,
    targetPath,
    templatesDirPath,
    featureDirNameTemplate = DEFAULT_FEATURE_DIR_NAME_TEMPLATE
}: IGeneratorOptions) {
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

/**
 * returns the path to features directory in the project
 * @param fs IFileSystem
 * @param path A general path in an project
 * @param featuresDir The features directory name (optional, if not used, returns `path` normalized)
 *
 * @examples
 * pathToFeaturesDirectory(fs, '/proj', 'packages');
 * // => '/proj/packages'
 *
 * pathToFeaturesDirectory(fs, '/proj/packages/some-feature', 'packages');
 * // => '/proj/packages'
 *
 * pathToFeaturesDirectory(fs, '/proj');
 * // => '/proj'
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
