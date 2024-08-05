import BaseWebApplicationFeature from './base-web-application.feature.js';

export default [
    BaseWebApplicationFeature.configure({
        baseAppConfig: {
            message: 'a configured message',
        },
    }),
];
