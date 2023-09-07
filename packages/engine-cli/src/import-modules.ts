import { dynamicImport } from '@wixc3/engine-runtime-node';
import { pathToFileURL } from 'node:url';

export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    for (const requiredModule of requiredModules) {
        try {
            await dynamicImport(pathToFileURL(require.resolve(requiredModule, { paths: [basePath] })));
        } catch (ex) {
            throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
        }
    }
}
