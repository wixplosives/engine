import { anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(anotherServerEnv, () => {
    return {
        anotherEchoService: {
            echo: (input: string | undefined = 'hiiiii') => {
                console.log(input);
                return Promise.resolve(String(input));
            },
        },
    };
});
