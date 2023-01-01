import { Feature } from '@wixc3/engine-core';
import ElectronApp from '../feature/electron-app.feature';

export default new Feature({
    id: 'electronAppFixture',
    api: {},
    dependencies: [ElectronApp],
});
