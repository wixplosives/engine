import BaseWebApplicationFeature from './base-web-application.feature.js';

export default [
    BaseWebApplicationFeature.use({
        baseAppConfig: {
            message: 'a configured message',
        },
    }),
];
