import UseConfigs from './use-configs.feature';

export const originalConfigValue = 'from config';

export default [
    UseConfigs.use({
        config: {
            echoText: originalConfigValue
        }
    })
];
