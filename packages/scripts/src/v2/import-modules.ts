// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importModule = new Function('modulePath', 'return import(modulePath);') as (modulePath: string) => Promise<any>;

export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    for (const requiredModule of requiredModules) {
        try {
            await importModule('file://' + require.resolve(requiredModule, { paths: [basePath] }));
        } catch (ex) {
            throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
        }
    }
}
