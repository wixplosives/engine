import UseConfigs, { main } from './use-configs.feature.js';

UseConfigs.setup(main, ({ config: { echoText } }) => {
    document.body.innerText = echoText;
});
