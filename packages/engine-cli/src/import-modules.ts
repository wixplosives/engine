import { pathToFileURL } from 'node:url';

// eslint-disable-next-line @typescript-eslint/no-implied-eval
export const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
    modulePath: string | URL
) => Promise<any>;

export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    for (const requiredModule of requiredModules) {
        try {
            await dynamicImport(pathToFileURL(require.resolve(requiredModule, { paths: [basePath] })));
        } catch (ex) {
            throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
        }
    }
}
