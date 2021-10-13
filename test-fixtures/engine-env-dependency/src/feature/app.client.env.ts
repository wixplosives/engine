import { client } from './app.feature';
import MyFeature from './app.feature';

MyFeature.setup(client, ({ wrapRender }) => {
    return {
        render(content) {
            window.document.body.innerHTML = [...wrapRender].reduce((acc, wrapper) => wrapper(acc), content);
        },
    };
});
