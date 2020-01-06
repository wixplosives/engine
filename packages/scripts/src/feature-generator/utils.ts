import { DirectoryContentMapper, ITemplateContext, IEnrichedTemplateContext } from './types';
import { IDirectoryContents, IFileSystem } from '@file-services/types';
import { toKebabCase, toCamelCase, toCapitalCase } from '../utils';

// adds display options to each context value
export function enrichContext(context: ITemplateContext): IEnrichedTemplateContext {
    return walkRecordValues(context, value => {
        const camel = toCamelCase(value);
        return Object.assign(new String(value), {
            camelCase: camel,
            dashCase: toKebabCase(value),
            pascalCase: toCapitalCase(camel)
        });
    });
}

export function readDirectoryContentsSync(fs: IFileSystem, path: string) {
    const dir: IDirectoryContents = {};
    _readDirectorySync(fs, path, dir);
    return dir;
}

export function mapDirectory(sourceDir: IDirectoryContents, mapper: DirectoryContentMapper): IDirectoryContents {
    return Object.entries(sourceDir).reduce((mappedDir: IDirectoryContents, [name, content]) => {
        if (typeof content === 'string') {
            const { name: mappedName, content: mappedContent } = mapper(name, content);
            return Object.assign(mappedDir, { [mappedName]: mappedContent });
        } else {
            const { name: mappedName } = mapper(name);
            return Object.assign(mappedDir, { [mappedName]: mapDirectory(content, mapper) });
        }
    }, {});
}

export function writeDirectoryContentsSync(fs: IFileSystem, directoryContents: IDirectoryContents, path: string) {
    fs.ensureDirectorySync(path);
    Object.entries(directoryContents).forEach(([name, content]) => {
        const currentPath = fs.join(path, name);
        if (typeof content === 'string') {
            console.info(`Creating file: ${currentPath}`);
            fs.writeFileSync(currentPath, content);
        } else {
            const subDirectory = directoryContents[name] as IDirectoryContents;
            writeDirectoryContentsSync(fs, subDirectory, currentPath);
        }
    });
}

function _readDirectorySync(fs: IFileSystem, path: string, dir: IDirectoryContents) {
    for (const node of fs.readdirSync(path, { withFileTypes: true })) {
        const currentPath = fs.join(path, node.name);
        if (node.isFile()) {
            dir[node.name] = fs.readFileSync(currentPath, { encoding: 'utf8' });
        } else if (node.isDirectory()) {
            _readDirectorySync(fs, currentPath, (dir[node.name] = {}));
        }
    }
}

function walkRecordValues<T, U>(obj: Record<string, T>, mappingMethod: (value: T) => U): Record<string, U> {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        acc[key] = mappingMethod(value);
        return acc;
    }, {} as Record<string, U>);
}
