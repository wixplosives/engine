import { Feature } from '@wixc3/engine-core';
import App from '../../feature/app.feature.js';

export default class Variant extends Feature<'Variant'> {
    id = 'Variant' as const;
    api = {};
    dependencies = [App];
}
