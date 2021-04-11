import External from './application-external.feature';
import { iframe } from '@fixture/static-base-web-application-feature/base-web-application.feature';

External.setup(iframe, ({}, { baseApp: { iframeSlot } }) => {
    iframeSlot.register('iframe from external');
});
