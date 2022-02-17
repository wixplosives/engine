import BaseWebApplicationFeature from './base-web-application.feature';

export default [
    BaseWebApplicationFeature.use({ 
        baseAppConfig: {
            message: 'a configured message',
        }
    })
]