import {
    createFeatureMapper,
    enrichContext,
    mapDirectory,
    pathToFeaturesDirectory,
    readDirectoryContentsSync,
    writeDirectoryContentsSync,
} from './utils.js';
import { templateCompilerProvider } from '@wixc3/common';
import { IFileSystem } from '@file-services/types';
import { EngineConfig } from '@wixc3/engine-scripts/src';
import fs from '@file-services/node';

const TEMPLATE_EXTENSION = '.tmpl';
const defaultTemplatesPath = fs.join(__dirname, 'templates');

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
    // where to put newly created feature
    const featuresDir = pathToFeaturesDirectory(fs, rootDir, featuresPath);

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
