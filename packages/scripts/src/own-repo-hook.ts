import Module from 'module';
import path from 'path';

export const inOwnRepo = __dirname.includes(path.normalize('/packages/scripts'));

if (inOwnRepo) {
    const originalResolveFileName = Module._resolveFilename;
    Module._resolveFilename = (request, params) => {
        if (inOwnRepo && request.startsWith('@wixc3/engine-') && request.lastIndexOf('/') === 6) {
            request += '/src';
        }
        return originalResolveFileName(request, params);
    };
}
