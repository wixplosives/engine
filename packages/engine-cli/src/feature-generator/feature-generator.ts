import type { IFileSystem } from '@file-services/types';
import { templateCompilerProvider } from '@wixc3/common';
import type { EngineConfig } from '@wixc3/engine-scripts';
import {
    createFeatureMapper,
    enrichContext,
    mapDirectory,
    pathToFeaturesDirectory,
    readDirectoryContentsSync,
    writeDirectoryContentsSync,
} from './utils.js';

export function generateFeature({
    fs,
    rootDir,
    featureName,
    featuresPath,
    templatesPath,
}: {
    fs: IFileSystem;
    rootDir: string;
    featureName: string;
    featuresPath: EngineConfig['featuresDirectory'];
    templatesPath: EngineConfig['featureTemplatesFolder'];
}) {
    const featuresDir = pathToFeaturesDirectory(fs, rootDir, featuresPath);

    const defaultTemplatesPath = fs.join(__dirname, 'templates');
    const templatesDirPath = templatesPath ? fs.join(rootDir, templatesPath) : defaultTemplatesPath;
    const templatesDir = readDirectoryContentsSync(fs, templatesDirPath);

    const templateContext = enrichContext({ featureName });
    const templateCompiler = templateCompilerProvider(templateContext);
    const featureMapper = createFeatureMapper(templateCompiler);

    const featureDirContent = mapDirectory(templatesDir, featureMapper);
    const featureDirName = templateCompiler('${featureName.dashCase}');
    const featureDirPath = fs.join(featuresDir, featureDirName);

    writeDirectoryContentsSync(fs, featureDirContent, featureDirPath);
}