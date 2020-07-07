import type { Page } from 'puppeteer';

export class FileServerDriver {
    public static async getFromRoot(root: Page) {
        await root.waitForSelector('body');
        return new FileServerDriver();
    }

    public async getPageContent(page: Page) {
        return await page.content();
    }

    public async getTestContentDiv(page: Page) {
        const elem = await page.waitForSelector('#testdiv');
        const textContent = await elem.getProperty('textContent');
        return textContent.jsonValue() as Promise<string>;
    }
}
