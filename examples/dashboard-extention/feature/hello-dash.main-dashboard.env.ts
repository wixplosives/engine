import dashExt from './hello-dash.feature';
import { mainDashboardEnv } from '@wixc3/engineer/dist/feature/gui.feature';

dashExt.setup(mainDashboardEnv, ({ run }, {}) => {
    run(() => {
        document.title = 'extending env';
    });
});
