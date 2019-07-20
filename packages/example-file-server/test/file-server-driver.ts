import { ConsoleMessage, Page } from 'puppeteer';

export class FileServerDriver {
    public static async getFromRoot(root: Page) {
        await root.waitForSelector('body');
        return new FileServerDriver();
    }

    public async getPageContent(page: Page) {
        return await page.content();
    }

    public async getTestContentDiv(page: Page) {
        const elem = await page.$eval('#testdiv', element => element.textContent);
        if (elem) {
            return elem;
        }
        return null;
    }

    public getConsoleData(page: Page, timeout: number = 2000): Promise<ConsoleMessage> {
        let wasResolved = false;
        return new Promise((resolve, reject) => {
            page.on('console', msg => {
                wasResolved = true;
                resolve(msg);
            });

            setTimeout(() => {
                if (!wasResolved) {
                    reject('Timeout when retrieving messages');
                }
            }, timeout);
        });
    }
}
