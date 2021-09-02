import { client } from '../../feature/app.feature';
import Variant from './variant.feature';

Variant.setup(client, ({}, { envDependencies: { wrapRender } }) => {
    wrapRender.register(
        (t) => `variant added to client
     ${t}`
    );
});
