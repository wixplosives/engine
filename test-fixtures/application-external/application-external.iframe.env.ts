import External from './application-external.feature';
import { iframe } from '@fixture/base-web-application-feature/base-web-application.feature';

External.setup(iframe, ({ }, { baseApp: { iframeSlot } }) => {
    iframeSlot.register('external');
});
