import UseConfigs, { main } from './use-configs.feature';

UseConfigs.setup(main, ({ config: { echoText } }) => {
    document.body.innerText = echoText;
});
