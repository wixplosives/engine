import MyFeature from './fixture.feature';
import { main } from '../feature/use-configs.feature';

MyFeature.setup(main, ({ run }) => {
    run(() => {
        document.body.innerText += `alternative`;
    });
});
