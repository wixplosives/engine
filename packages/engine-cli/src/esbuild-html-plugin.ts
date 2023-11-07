import fs from '@file-services/node';
import { Plugin } from 'esbuild';

export interface HTMLPluginOptions {
    toHtmlPath?: (fileName: string) => string;
    title?: string;
}

/** create html for each entrypoint */
export function htmlPlugin({
    title = 'Application',
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
                                text: "html-plugin: build failed, can't generate html files.",
                            },
                        ],
                    };
                }
                if (!metafile) {
                    throw new Error('metafile must be set when using html-plugin');
                }
                const cwd = build.initialOptions.absWorkingDir || process.cwd();
                for (const [key, meta] of Object.entries(metafile.outputs)) {
                    if (!key.match(/\.m?js$/)) {
                        continue;
                    }
                    const fileName = fs.basename(key);
                    const jsDir = fs.dirname(key);
                    const htmlFile = fs.join(jsDir, toHtmlPath(fileName));
                    const cssPath = meta.cssBundle ? fs.basename(meta.cssBundle) : undefined;
                    const htmlContent = deindento(`
                        |<!DOCTYPE html>
                        |<html>
                        |    <head>
                        |        <meta charset="utf-8" />
                        |        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        |        <title>${title}</title>
                        |        ${cssPath ? `<link rel="stylesheet" href="${cssPath}" />` : ''}
                        |    </head>
                        |    <body>
                        |        <script type="module" src="${fileName}" crossorigin="anonymous"></script>
                        |    </body>
                        |</html>
                    `);
                    fs.writeFileSync(fs.join(cwd, htmlFile), htmlContent);
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