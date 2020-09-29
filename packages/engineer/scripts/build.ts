import ts from 'typescript';
import { build } from '@ts-tools/build';
import nodeFs from '@file-services/node';

const { writeFileSync, resolve, dirname, ensureDirectorySync } = nodeFs;

const outDir = 'cjs';
const rootDir = process.cwd();
const buildDirectories = ['engine-dashboard', 'src', 'feature'];

try {
    // Build ts files
    for (const dir of buildDirectories) {
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
    }
} catch (e) {
    printErrorAndExit(e);
}

function printErrorAndExit(message: unknown) {
    // eslint-disable-next-line no-console
    console.error(message);
    process.exitCode = 1;
}
