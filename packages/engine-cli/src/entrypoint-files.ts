import fs from '@file-services/node';
import { join } from 'node:path';
import { EntryPointsPaths, EntryPoints } from './create-entrypoints';

export function writeEntryPoints(dir: string, { nodeEntryPoints, webEntryPoints }: EntryPoints): EntryPointsPaths {
    const outDirWeb = join(dir, 'entrypoints', 'web');
    const outDirNode = join(dir, 'entrypoints', 'node');
    fs.mkdirSync(outDirWeb, { recursive: true });
    fs.mkdirSync(outDirNode, { recursive: true });
    const webEntryPointsPaths = [];
    const nodeEntryPointsPaths = [];
    for (const [name, content] of webEntryPoints) {
        const path = join(outDirWeb, name);
        webEntryPointsPaths.push(path);
        fs.writeFileSync(path, content);
    }
    for (const [name, content] of nodeEntryPoints) {
        const path = join(outDirNode, name);
        nodeEntryPointsPaths.push(path);
        fs.writeFileSync(path, content);
    }
    return { webEntryPointsPaths, nodeEntryPointsPaths };
}

export function readEntryPoints(dir: string): (EntryPoints & EntryPointsPaths) | undefined {
    try {
        const webDir = join(dir, 'entrypoints', 'web');
        const nodeDir = join(dir, 'entrypoints', 'node');
        const webEntryPoints = readDirShallowIntoMap(webDir);
        const nodeEntryPoints = readDirShallowIntoMap(nodeDir);
        const webEntryPointsPaths = Array.from(webEntryPoints.keys()).map((name) => join(webDir, name));
        const nodeEntryPointsPaths = Array.from(nodeEntryPoints.keys()).map((name) => join(nodeDir, name));
        return { webEntryPoints, nodeEntryPoints, webEntryPointsPaths, nodeEntryPointsPaths };
    } catch {
        return undefined;
    }
}

function readDirShallowIntoMap(dir: string) {
    return fs.readdirSync(dir).reduce((acc, name) => {
        acc.set(name, fs.readFileSync(join(dir, name), 'utf-8'));
        return acc;
    }, new Map<string, string>());
}
