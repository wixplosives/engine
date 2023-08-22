import { client } from '../../feature/app.feature.js';
import Variant from './variant.feature.js';

Variant.setup(client, ({}, { envDependencies: { wrapRender } }) => {
    wrapRender.register((t) => `variant added to client ${t}`);
});
