import BaseAppFeature, { server } from './base-web-application.feature';

BaseAppFeature.setup(server, ({ serverSlot }) => {
    return {
        dataProvider: {
            getData: () => [...serverSlot],
        },
    };
});
