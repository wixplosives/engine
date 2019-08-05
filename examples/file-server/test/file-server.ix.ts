import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { FileServerDriver } from './file-server-driver';

describe('File Server Feature', () => {
    const { getLoadedFeature } = withFeature({
        featureName: 'engine-example-file-server/example',
        configName: 'engine-example-file-server/run'
    });

    it('lists working directory contents in DOM', async () => {
        const { page } = await getLoadedFeature();
        const fileServerDriver = await FileServerDriver.getFromRoot(page);
        const preview = await fileServerDriver.getTestContentDiv(page);
        const parsedData = JSON.parse(preview);
        expect(parsedData).to.be.an('object');
        expect(parsedData.fixtures).to.be.an('object');
        expect(parsedData.fixtures['example.feature.ts']).to.have.keys('filePath', 'fileName');
    });
});
