import path from 'path';
import { withFeature } from '@wixc3/engine-test-kit';
import { waitFor } from 'promise-assist';
import { expect } from 'chai';
import { FileServerDriver } from './file-server-driver';
import fileServerFeature, { SERVER_MARK, MAIN_MARK } from '../feature/file-server.feature';

describe('File Server Feature', function () {
    this.timeout(20_000);

    const { getLoadedFeature } = withFeature({
        featureName: 'file-server/example',
        configName: 'file-server/run',
        runOptions: {
            projectPath: path.dirname(__dirname),
        },
        config: [
            fileServerFeature.use({
                config: {
                    title: 'test-title',
                },
            }),
        ],
    });

    it('lists working directory contents in DOM', async () => {
        const { page, getMetrics } = await getLoadedFeature();
        const fileServerDriver = await FileServerDriver.getFromRoot(page);
        const preview = await fileServerDriver.getTestContentDiv(page);
        const parsedData = JSON.parse(preview) as { fixtures: Record<string, string[]> };
        expect(parsedData).to.be.an('object');
        expect(parsedData.fixtures).to.be.an('object');
        expect(parsedData.fixtures['example.feature.js']).to.have.keys('filePath', 'fileName');
        expect(await page.title()).to.eq('test-title');
        const metrics = await getMetrics();
        expect(metrics.marks.length).to.eq(2);
        const browserMark = metrics.marks.find((m) => m.name === MAIN_MARK);
        const serverMark = metrics.marks.find((m) => m.name === SERVER_MARK);
        expect(browserMark, 'should receive browser marks').not.be.undefined;
        expect(serverMark, 'should receive server marks').not.be.undefined;
    });

    it('validating metrics are being cleared between runs', async () => {
        const { getMetrics } = await getLoadedFeature();

        await waitFor(async () => {
            const metrics = await getMetrics();
            expect(metrics.marks.length).to.eq(2);
            const browserMark = metrics.marks.find((m) => m.name === MAIN_MARK);
            const serverMark = metrics.marks.find((m) => m.name === SERVER_MARK);
            expect(browserMark, 'should receive browser marks').not.be.undefined;
            expect(serverMark, 'should receive server marks').not.be.undefined;
        });
    });
});
