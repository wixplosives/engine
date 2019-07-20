import Module from 'module';
import { join } from 'path';

export function resolveFrom(fromDirectory: string, request: string): string | undefined {
    const filename = join(fromDirectory, 'mocked.js');
    const paths = Module._nodeModulePaths(fromDirectory);

    try {
        return Module._resolveFilename(request, { id: filename, filename, paths });
    } catch {
        return undefined;
    }
}
