import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const targetNodeModules = path.resolve('../component-studio/node_modules');
if (!fs.existsSync(targetNodeModules)) {
    throw new Error('target node_modules does not exist: ' + targetNodeModules);
} else {
    console.log('targetNodeModules:', targetNodeModules);
}

const files = ts.sys.readDirectory(ts.sys.resolvePath('.'), undefined, undefined, ['packages/*/package.json']);
const packageJSONs = files
    .map((file) => ({
        pkg: JSON.parse(ts.sys.readFile(file) || 'null'),
        dir: path.dirname(file),
    }))
    .filter((json) => json);

for (const { pkg, dir } of packageJSONs) {
    console.log(pkg.name, dir);
    const targetPackageLocation = path.join(targetNodeModules, pkg.name);
    if (fs.existsSync(targetPackageLocation) && fs.statSync(targetPackageLocation).isDirectory()) {
        fs.rmdirSync(targetPackageLocation, { recursive: true });
        fs.mkdirSync(targetPackageLocation, { recursive: true });
        fs.cpSync(dir, targetPackageLocation, { recursive: true });
        console.log('COPIED', pkg.name, 'to target node_modules');
    } else {
        console.log('SKIP', pkg.name, 'does not exist in target node_modules');
    }
}
