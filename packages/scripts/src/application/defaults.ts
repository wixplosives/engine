import type { IBuildCommandOptions } from "./types";

export const DEFAULT_EXTERNAL_FEATURES_PATH = 'external-features.json';

export const buildDefaults = {
    mode : 'production',
    external : false,
    staticBuild : true,
    staticExternalFeaturesFileName : DEFAULT_EXTERNAL_FEATURES_PATH,
    externalFeatureDefinitions: []
}

export type BuildOptions = IBuildCommandOptions & typeof buildDefaults