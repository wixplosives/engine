import { page1 } from './app.feature';
import MyFeature from './app.feature';

MyFeature.setup(page1, ({ render, run }) => {
    run(() => {
        render(page1.env);
    });
});
