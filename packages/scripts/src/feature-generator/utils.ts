import type { DirectoryContentMapper, ITemplateContext, IEnrichedTemplateContext } from './types';
import type { IDirectoryContents, IFileSystem } from '@file-services/types';
import { toKebabCase, toCamelCase, capitalizeFirstLetter } from '@wixc3/common';

// adds display options to each context value
export function enrichContext(context: ITemplateContext): IEnrichedTemplateContext {
    return walkRecordValues(context, (value) => {
        const camel = toCamelCase(value);
        return Object.assign(new String(value), {
            camelCase: camel,
            dashCase: toKebabCase(value),
            pascalCase: capitalizeFirstLetter(camel),
        });
    });
}

export function readDirectoryContentsSync(fs: IFileSystem, path: string) {
    const directoryEntries = fs.readdirSync(path, { withFileTypes: true });

    return directoryEntries.reduce((dir, entry) => {
        const currentPath = fs.join(path, entry.name);

        if (entry.isFile()) {
            dir[entry.name] = fs.readFileSync(currentPath, { encoding: 'utf8' });
        } else if (entry.isDirectory()) {
            dir[entry.name] = readDirectoryContentsSync(fs, currentPath);
        }

        return dir;
    }, {} as IDirectoryContents);
}

export function mapDirectory(sourceDir: IDirectoryContents, mapper: DirectoryContentMapper): IDirectoryContents {
    return Object.entries(sourceDir).reduce((mappedDir: IDirectoryContents, [name, content]) => {
        if (typeof content === 'string') {
            const { name: mappedName, content: mappedContent } = mapper(name, content);
            mappedDir[mappedName] = mappedContent || '';
        } else {
            const { name: mappedName } = mapper(name);
            mappedDir[mappedName] = mapDirectory(content, mapper);
        }

        return mappedDir;
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

function walkRecordValues<T, U, K extends string>(obj: Record<K, T>, mappingMethod: (value: T) => U): Record<K, U> {
    return (Object.entries<T>(obj) as Array<[K, T]>).reduce(
        (acc, [key, value]) => {
            acc[key] = mappingMethod(value);
            return acc;
        },
        {} as Record<K, U>,
    );
}
