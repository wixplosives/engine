import { createRequire } from 'module';
import { join } from 'path';

/**
 * @deprecated use `require.resolve(request, {paths: [directoryPath]})` instead.
 */
export function resolveFrom(
    directoryPath: string,
    request: string,
    options?: { paths?: string[] }
): string | undefined {
    const require = createRequire(join(directoryPath, 'requesting-file.js'));
    try {
        return require.resolve(request, options);
    } catch {
        return undefined;
    }
}
