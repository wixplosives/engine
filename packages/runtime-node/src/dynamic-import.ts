// until we move to native esm, we need to use this hack to get dynamic imports to work
// eslint-disable-next-line @typescript-eslint/no-implied-eval
export const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
    modulePath: string | URL,
) => Promise<{ default: unknown }>;
