import BaseAppFeature, { server } from './base-web-application.feature.js';

BaseAppFeature.setup(server, ({ serverSlot }) => {
    return {
        dataProvider: {
            getData: () => [...serverSlot],
        },
    };
});
