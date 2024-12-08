import fs from 'node:fs';
import path from 'node:path';
import { EntryPointsPaths, EntryPoints } from './create-entrypoints.js';

export function writeEntryPoints(dir: string, { nodeEntryPoints, webEntryPoints }: EntryPoints): EntryPointsPaths {
    const outDirWeb = path.join(dir, 'entrypoints', 'web');
    const outDirNode = path.join(dir, 'entrypoints', 'node');
    fs.mkdirSync(outDirWeb, { recursive: true });
    fs.mkdirSync(outDirNode, { recursive: true });
    const webEntryPointsPaths = [];
    const nodeEntryPointsPaths = [];
    for (const [name, content] of webEntryPoints) {
        const entryFilePath = path.join(outDirWeb, name);
        webEntryPointsPaths.push(entryFilePath);
        fs.writeFileSync(entryFilePath, content);
    }
    for (const [name, content] of nodeEntryPoints) {
        const entryFilePath = path.join(outDirNode, name);
        nodeEntryPointsPaths.push(entryFilePath);
        fs.writeFileSync(entryFilePath, content);
    }
    return { webEntryPointsPaths, nodeEntryPointsPaths };
}

export function readEntryPoints(dir: string): (EntryPoints & EntryPointsPaths) | undefined {
    try {
        const webDir = path.join(dir, 'entrypoints', 'web');
        const nodeDir = path.join(dir, 'entrypoints', 'node');
        const webEntryPoints = readDirShallowIntoMap(webDir);
        const nodeEntryPoints = readDirShallowIntoMap(nodeDir);
        const webEntryPointsPaths = Array.from(webEntryPoints.keys()).map((name) => path.join(webDir, name));
        const nodeEntryPointsPaths = Array.from(nodeEntryPoints.keys()).map((name) => path.join(nodeDir, name));
        return { webEntryPoints, nodeEntryPoints, webEntryPointsPaths, nodeEntryPointsPaths };
    } catch {
        return undefined;
    }
}

function readDirShallowIntoMap(dir: string) {
    return fs.readdirSync(dir).reduce((acc, name) => {
        acc.set(name, fs.readFileSync(path.join(dir, name), 'utf-8'));
        return acc;
    }, new Map<string, string>());
}
