import { nodeFs as fs } from '@file-services/node';
import { pathToFileURL } from 'node:url';
import { createRequestResolver } from '@file-services/resolve';
/**
 * Dynamically imports required modules using the specified base path.
 * @param basePath The base path to use for resolving module paths.
 * @param requiredModules An array of module names to import.
 * @throws An error if any of the required modules fail to import.
 */
export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    const resolveSpecifier = createRequestResolver({ fs, conditions: ['node', 'import', 'require'] });
    for (const specifier of requiredModules) {
        const { resolvedFile } = resolveSpecifier(basePath, specifier);
        if (!resolvedFile) {
            throw new Error(`failed to resolve module: ${specifier}`);
        }
        try {
            await import(pathToFileURL(resolvedFile).href);
        } catch (ex) {
            throw new Error(`failed evaluating: ${resolvedFile}`, { cause: ex });
        }
    }
}
