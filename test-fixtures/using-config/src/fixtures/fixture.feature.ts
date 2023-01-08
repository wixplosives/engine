import { EngineFeature } from '@wixc3/engine-core';
import UseConfigsFeature from '../feature/use-configs.feature';

export default class AlternativeDisplay extends EngineFeature<'alternativeDisplay'> {
    id = 'alternativeDisplay' as const;
    api = {};
    dependencies = [UseConfigsFeature];
}
