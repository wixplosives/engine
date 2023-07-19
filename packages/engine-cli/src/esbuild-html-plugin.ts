import fs from '@file-services/node';
import { Plugin } from 'esbuild';

///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////
export function htmlPlugin({ toHtmlPath = (key: string) => key.replace(/\.m?js$/, '.html') } = {}) {
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
                    const jsPath = fs.basename(key);
                    const jsDir = fs.dirname(key);
                    const htmlFile = fs.join(jsDir, toHtmlPath(jsPath));
                    const cssPath = meta.cssBundle ? fs.basename(meta.cssBundle) : undefined;
                    const htmlContent = deindento(`
                        |<!DOCTYPE html>
                        |<html>
                        |    <head>
                        |        <meta charset="utf-8" />
                        |        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        |        <title>Wixc3</title>
                        |        ${cssPath ? `<link rel="stylesheet" href="${cssPath}" />` : ''}
                        |    </head>
                        |    <body>
                        |        <script type="module" src="${jsPath}" crossorigin="anonymous"></script>
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
