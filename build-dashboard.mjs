import fs from 'node:fs';
fs.cpSync('./packages/engine-cli/src/dashboard', './packages/engine-cli/dist/dashboard', {
    recursive: true,
    filter: (src) => {
        if (src.endsWith('.ts')) {
            return false;
        }
        return true;
    },
});
console.log('Copied dashboard to dist');
