import External from './application-external.feature.js';
import { iframe } from '@fixture/static-base-web-application-feature/dist/base-web-application.feature.js';

External.setup(iframe, ({}, { baseApp: { iframeSlot } }) => {
    iframeSlot.register('iframe from external');
});
