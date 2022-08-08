import { Feature } from '@wixc3/engine-core';
import Gui from '@wixc3/engineer/dist/feature/gui.feature';

export default new Feature({
    id: 'dashboardExt',
    dependencies: [Gui.asDependency],
    api: {},
});
