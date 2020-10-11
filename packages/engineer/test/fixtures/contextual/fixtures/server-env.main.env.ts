import { mainEnv } from '../feature/some-feature.feature';
import ExampleFeature from './server-env.feature';

ExampleFeature.setup(mainEnv, ({ run }, { multiEnv: { serverService } }) => {
    run(async () => {
        document.body.innerText = await serverService.echo();
    });
});
