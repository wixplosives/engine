import { MAIN } from '@fixture/3rd-party/3rd-party.feature';
import UseConfigs from './use-configs.feature';

UseConfigs.setup(MAIN, ({ config: { echoText } }) => {
    document.body.innerText = echoText;
    return null;
});
