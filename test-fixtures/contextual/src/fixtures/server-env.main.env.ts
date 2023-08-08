import { mainEnv } from '../feature/some-feature.feature.js';
import ExampleFeature from './server-env.feature.js';

ExampleFeature.setup(mainEnv, ({ run }, { multiEnv: { serverService } }) => {
    run(async () => {
        document.body.innerText = await serverService.echo();
    });
});
