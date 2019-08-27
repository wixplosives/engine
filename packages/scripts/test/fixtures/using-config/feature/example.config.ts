import UseConfigs from './use-configs.feature';

export default [
    UseConfigs.use({
        config: {
            echoText: 'modified config'
        }
    })
];
