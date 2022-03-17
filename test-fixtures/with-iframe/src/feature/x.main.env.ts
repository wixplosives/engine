import { iframeInitializer } from '@wixc3/engine-com';
import { mainEnv, iframeEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { communication } }) => {
    const myFrame = document.createElement('iframe');
    myFrame.id = 'iframe';
    document.body.append(myFrame);

    run(async () => {
        await iframeInitializer({
            communication,
            env: iframeEnv,
            iframeElement: myFrame,
        });
        await echoService.echo('echo');
    });
});
