import { dirname } from 'path';
import ts from 'typescript';
import { build } from '@ts-tools/build';
import nodeFs from '@file-services/node';

const { findFilesSync, readFileSync, populateDirectorySync, writeFileSync, statSync, mkdirSync, resolve } = nodeFs;

try {
    const outDir = 'cjs';
    const rootDir = process.cwd();
    // Build ts files
    const buildDirectories = ['engine-dashboard', 'src', 'feature'];
    buildDirectories.forEach((dir) => {
        const targetFiles = build({
            srcDirectoryPath: resolve(rootDir, dir),
            outputDirectoryPath: resolve(rootDir, outDir),
            formats: [
                {
                    folderName: dir,
                    getCompilerOptions(tsconfigOptions) {
                        return {
                            ...tsconfigOptions,
                            module: ts.ModuleKind.CommonJS,
                        };
                    },
                },
            ],
        });

        // eslint-disable-next-line no-console
        console.log(`Done transpiling ${dir}. Writing ${targetFiles.length} files...`);
        for (const { name, text } of targetFiles) {
            ensureDirectorySync(dirname(name));
            writeFileSync(name, text);
        }
    });

    // Copy styleable files - once we ship the dashboard prebuilt we will need to remove this
    copySourcesToFolder(resolve(rootDir, 'engine-dashboard'), resolve(rootDir, outDir, 'engine-dashboard'), [
        '.st.css',
    ]);
} catch (e) {
    printErrorAndExit(e);
}

function printErrorAndExit(message: unknown) {
    // eslint-disable-next-line no-console
    console.error(message);
    process.exitCode = 1;
}

function ensureDirectorySync(directoryPath: string): void {
    try {
        if (statSync(directoryPath).isDirectory()) {
            return;
        }
    } catch {
        /**/
    }
    try {
        mkdirSync(directoryPath);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') {
            const parentPath = dirname(directoryPath);
            if (parentPath === directoryPath) {
                throw e;
            }
            ensureDirectorySync(parentPath);
            mkdirSync(directoryPath);
        }
    }
}

function copySourcesToFolder(srcDir: string, targetDir: string, includeExtentions?: string[]) {
    const directoryPaths = findFilesSync(srcDir, {
        filterFile: ({ name }) => {
            return !includeExtentions || !!includeExtentions.find((ext) => name.endsWith(ext));
        },
    });
    const directoryContents = directoryPaths.reduce((contents, filePath) => {
        const relativeFilePath = filePath.substr(srcDir.length);
        contents[relativeFilePath] = readFileSync(filePath, 'utf8');
        return contents;
    }, {} as Record<string, string>);
    populateDirectorySync(targetDir, directoryContents);
}
