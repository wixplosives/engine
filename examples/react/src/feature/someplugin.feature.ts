import { Feature } from '@wixc3/engine-core';
import guiFeature from './gui.feature';

export default class Plugin extends Feature<'plugin'> {
    id = 'plugin' as const;
    api = {};
    dependencies = [guiFeature];
}
