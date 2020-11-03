import { Feature } from '@wixc3/engine-core';
import App from '@fixture/engine-multi/feature/app.feature';

export default new Feature({
    id: 'Variant',
    api: {},
    dependencies: [App],
});
