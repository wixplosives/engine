import { mainDashboardEnv } from '@wixc3/engineer/dist/feature/gui.feature';
import dashExt from './hello-dash.feature';

dashExt.setup(mainDashboardEnv, ({ run }, {}) => {
    run(() => {
        document.title = 'extending env';
    });
});
