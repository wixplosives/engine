import { DirectoryContentMapper, ITemplateContext, IEnrichedTemplateContext } from './types';
import { IDirectoryContents, IFileSystem } from '@file-services/types';
import { kebabCase, camelCase, upperFirst } from '../utils/string-utils';

// adds display options to each context value
export function enrichContext(context: ITemplateContext): IEnrichedTemplateContext {
    return mapValues(context, value => {
        const camel = camelCase(value);
        return Object.assign(new String(value), {
            camelCase: camel,
            dashCase: kebabCase(value),
            pascalCase: upperFirst(camel)
        });
    });
}

export function readDirectorySync(fs: IFileSystem, path: string) {
    const dir: IDirectoryContents = {};
    _readDirectorySync(fs, path, dir);
    return dir;
}

export function mapDirectory(
    sourceDir: IDirectoryContents,
    mapper: DirectoryContentMapper,
    targetDir: IDirectoryContents = {}
) {
    _mapDirectory(sourceDir, mapper, targetDir);
    return targetDir;
}

export function writeDirectorySync(fs: IFileSystem, directoryContents: IDirectoryContents, path: string) {
    fs.ensureDirectorySync(path);
    Object.entries(directoryContents).forEach(([name, content]) => {
        const currentPath = fs.join(path, name);
        if (typeof content === 'string') {
            console.info(`Creating file: ${currentPath}`);
            fs.writeFileSync(currentPath, content);
        } else {
            const subDirectory = directoryContents[name] as IDirectoryContents;
            writeDirectorySync(fs, subDirectory, currentPath);
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

function _mapDirectory(
    sourceDir: IDirectoryContents,
    mapper: DirectoryContentMapper,
    targetDir: IDirectoryContents = {}
) {
    Object.entries(sourceDir).forEach(([name, content]) => {
        if (typeof content === 'string') {
            const { name: mappedName, content: mappedContent } = mapper(name, content);
            targetDir[mappedName] = mappedContent!;
        } else {
            const { name: mappedName } = mapper(name);
            _mapDirectory(content, mapper, (targetDir[mappedName] = {}));
        }
    });
}

function mapValues<T, U, K extends string>(obj: Record<K, T>, mapper: (value: T) => U): Record<K, U> {
    return Object.entries(obj).reduce(
        (mappedObj, [key, value]) =>
            Object.assign(mappedObj, {
                [key]: mapper(value as T)
            }),
        {} as Record<K, U>
    );
}
