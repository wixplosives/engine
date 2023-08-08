import { Feature } from '@wixc3/engine-core';
import ElectronApp from '../feature/electron-app.feature.js';

export default class ElectronAppFixture extends Feature<'electronAppFixture'> {
    id = 'electronAppFixture' as const;
    api = {};
    dependencies = [ElectronApp];
}
