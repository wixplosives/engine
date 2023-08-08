import { page1 } from '../../feature/app.feature.js';
import Variant from './variant.feature.js';

Variant.setup(page1, ({}, { envDependencies: { wrapRender } }) => {
    wrapRender.register((t) => `variant added to ${t}`);
});
