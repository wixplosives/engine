/**
 * When using native dynamic `import()` to evaluate a esm-as-cjs module,
 * node messes up the module's shape, and the default export is nested under `default` property.
 * This function is used to get the original module shape.
 */
export function getOriginalModule(moduleExports: unknown): unknown {
    return isObjectLike(moduleExports) &&
        'default' in moduleExports &&
        isObjectLike(moduleExports.default) &&
        '__esModule' in moduleExports.default &&
        !!moduleExports.default.__esModule
        ? moduleExports.default
        : moduleExports;
}

function isObjectLike(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}
