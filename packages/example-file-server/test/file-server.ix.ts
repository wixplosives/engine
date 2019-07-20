import { withFeature } from '@wixc3/engine-test-kit';
import { expect } from 'chai';
import { ConsoleMessage, Page } from 'puppeteer';
import { FileServerDriver } from './file-server-driver';

describe('Test file server festure', () => {
    const { getLoadedFeature } = withFeature(__dirname, { featureName: 'example', configName: 'run' });
    let page: Page;
    let fileServerDriver: FileServerDriver;
    let consoleData: ConsoleMessage;

    beforeEach(async () => {
        page = (await getLoadedFeature()).page;
        fileServerDriver = await FileServerDriver.getFromRoot(page);
        if (!consoleData) {
            consoleData = await fileServerDriver.getConsoleData(page, 1000);
        }
    });

    describe('Check basic connectivity', () => {
        it('prints something on the screen', async () => {
            const preview = await fileServerDriver.getTestContentDiv(page);
            expect(preview).to.have.length.gt(0);
        });
    });

    describe('check file server capabilities', () => {
        it('prints returns folder directory and prints it', async () => {
            const preview = await fileServerDriver.getTestContentDiv(page);
            expect(preview).to.have.length.gt(0);
            const parsedData = JSON.parse(preview!);
            expect(parsedData).to.be.an('object');
            expect(Object.keys(parsedData)).to.have.length.gt(0);
            expect(parsedData.fixtures['example.feature.ts']).to.have.keys('filePath', 'fileName');
        });

        it('returns file data in console', async () => {
            const packageJsonFile = JSON.parse(consoleData.text());
            expect(packageJsonFile.private).to.be.eq(true);
        });
    });
});
