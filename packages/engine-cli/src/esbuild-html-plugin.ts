import type { Plugin } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

export interface HTMLPluginOptions {
    toHtmlPath?: (fileName: string) => string;
    title?: string;
    faviconFilePath?: string;
}

/** create html for each entrypoint */
export function htmlPlugin({
    title = 'Application',
    faviconFilePath,
    toHtmlPath = (fileName: string) => fileName.replace(/\.m?js$/, '.html'),
}: HTMLPluginOptions = {}) {
    const plugin: Plugin = {
        name: 'html-plugin',
        setup(build) {
            build.onEnd(({ metafile, errors }) => {
                if (errors.length > 0) {
                    return {
                        errors: [
                            {
                                text: 'html-plugin: failed to generate HTML because there were errors in the build.',
                            },
                        ],
                    };
                }
                if (!metafile) {
                    throw new Error('metafile must be set when using html-plugin');
                }
                const iconName = faviconFilePath ? path.basename(faviconFilePath) : 'favicon.ico';
                const cwd = build.initialOptions.absWorkingDir || process.cwd();
                for (const [key, meta] of Object.entries(metafile.outputs)) {
                    if (!key.match(/\.m?js$/)) {
                        continue;
                    }
                    const fileName = path.basename(key);
                    const jsDir = path.dirname(key);
                    const htmlFile = path.join(jsDir, toHtmlPath(fileName));
                    const cssPath = meta.cssBundle ? path.basename(meta.cssBundle) : undefined;
                    const htmlContent = deindento(`
                        |<!DOCTYPE html>
                        |<html lang="en">
                        |    <head>
                        |        <meta charset="utf-8">
                        |        <title>${title}</title>
                        |        <link rel="icon" href="${iconName}">
                        |        <meta name="viewport" content="width=device-width, initial-scale=1">
                        |        ${cssPath ? `<link rel="stylesheet" href="${cssPath}">` : ''}
                        |    </head>
                        |    <body>
                        |        <script type="module" src="${fileName}" crossorigin="anonymous"></script>
                        |    </body>
                        |</html>
                    `);
                    if (faviconFilePath) {
                        fs.copyFileSync(faviconFilePath, path.join(cwd, jsDir, iconName));
                    }
                    fs.writeFileSync(path.join(cwd, htmlFile), htmlContent);
                }
                return null;
            });
        },
    };
    return plugin;
}
function deindento(str: string) {
    const lines = str
        .trim()
        .split('\n')
        .map((line) => line.replace(/^\s*\|/, ''))
        .filter((line) => line.trim() !== '');

    return lines.join('\n');
}
