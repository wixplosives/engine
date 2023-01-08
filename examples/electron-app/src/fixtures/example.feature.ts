import { EngineFeature } from '@wixc3/engine-core';
import ElectronApp from '../feature/electron-app.feature';

export default class ElectronAppFixture extends EngineFeature<'electronAppFixture'> {
    id = 'electronAppFixture' as const;
    api = {};
    dependencies = [ElectronApp];
}
