import fs from 'node:fs';
import path from 'node:path';
/**
 * This function links node_modules from a path to the project.
 * This has a BROKEN/QUESTIONABLE mechanism to handle packages that was inside the workspace
 * This will break if there will be confecting packages in root and package.
 */
export const linkNodeModules = (toPath: string, fromNodeModules: string) => {
    const targetNodeModules = path.join(toPath, 'node_modules');
    if (fs.existsSync(targetNodeModules)) {
        const items = fs.readdirSync(targetNodeModules);
        // happens because the project path exists in the workspaces of the root package.json
        if (items.length === 1 && items[0] === '.bin') {
            fs.rmSync(targetNodeModules, { force: true, recursive: true });
        }
    }
    // link top most node_modules instead of installing all packages
    fs.symlinkSync(fromNodeModules, targetNodeModules, 'junction');
};
