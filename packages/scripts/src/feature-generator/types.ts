export interface IGeneratorOptions {
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

interface IEnrichedString extends String {
    camelCase: string;
    dashCase: string;
    pascalCase: string;
}
