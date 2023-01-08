import { EngineFeature } from '@wixc3/engine-core';
import App from '../../feature/app.feature';

export default class Variant extends EngineFeature<'Variant'> {
    id = 'Variant' as const;
    api = {};
    dependencies = [App];
}
