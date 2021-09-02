import { page1 } from '../../feature/app.feature';
import Variant from './variant.feature';

Variant.setup(page1, ({}, { envDependencies: { wrapRender } }) => {
    wrapRender.register(
        (t) => `variant added to page 1
     ${t}`
    );
});
