import { pathToFileURL } from 'node:url';
import { dynamicImport } from './dynamic-import';

/**
 * Dynamically imports required modules using the specified base path.
 * @param basePath The base path to use for resolving module paths.
 * @param requiredModules An array of module names to import.
 * @throws An error if any of the required modules fail to import.
 */
export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    for (const requiredModule of requiredModules) {
        try {
            await dynamicImport(pathToFileURL(require.resolve(requiredModule, { paths: [basePath] })));
        } catch (ex) {
            throw new Error(`failed importing: ${requiredModule}`, { cause: ex });
        }
    }
}
