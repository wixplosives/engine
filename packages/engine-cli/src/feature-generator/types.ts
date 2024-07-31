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
