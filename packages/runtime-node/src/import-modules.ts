export async function importModules(basePath: string, requiredModules: string[]): Promise<void> {
    for (const requiredModule of requiredModules) {
        try {
            await import(require.resolve(requiredModule, { paths: [basePath] }));
        } catch (ex) {
            throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
        }
    }
}
