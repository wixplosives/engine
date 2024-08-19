export type DirectoryContentMapper = (name: string, content?: string) => { name: string; content?: string };

export type ITemplateContext = {
    featureName: string;
};

export type IEnrichedTemplateContext = Record<keyof ITemplateContext, IEnrichedString>;

// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
export interface IEnrichedString extends String {
    camelCase: string;
    dashCase: string;
    pascalCase: string;
}
