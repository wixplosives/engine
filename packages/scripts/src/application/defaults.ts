import type { IBuildCommandOptions } from './types.js';

export const buildDefaults = {
    mode: 'production',
    staticBuild: true,
};

export type BuildOptions = IBuildCommandOptions & typeof buildDefaults;
