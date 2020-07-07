import type { IFileSystem } from '@file-services/types';

export interface IGeneratorOptions {
    fs: IFileSystem;
    featureName: string;
    targetPath: string;
    templatesDirPath: string;
    featureDirNameTemplate?: string;
}

export type DirectoryContentMapper = (name: string, content?: string) => { name: string; content?: string };

export type ITemplateContext = {
    featureName: string;
};

export type IEnrichedTemplateContext = Record<keyof ITemplateContext, IEnrichedString>;

export interface IEnrichedString extends String {
    camelCase: string;
    dashCase: string;
    pascalCase: string;
}
