

const featurePackagePostfix = '-feature';

export function scopeToPackage(packageName: string, entityName: string) {
    return packageName === entityName ? entityName : `${packageName}/${entityName}`;
}

/**
 * Removes package scope (e.g `@wix`) and posfix `-feature`.
 */
export function simplifyPackageName(name: string) {
    const indexOfSlash = name.indexOf('/');
    if (name.startsWith('@') && indexOfSlash !== -1) {
        name = name.slice(indexOfSlash + 1);
    }
    if (name.endsWith(featurePackagePostfix)) {
        name = name.slice(0, -featurePackagePostfix.length);
    }
    return name;
}
