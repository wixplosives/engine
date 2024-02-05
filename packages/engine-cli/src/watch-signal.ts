// on exit

import fs from 'node:fs';
import path from 'node:path';

export function writeWatchSignal(baseDir: string, data: { isAliveUrl: string }) {
    const watchSignalPath = path.join(baseDir, '.watch-signal');
    fs.writeFileSync(watchSignalPath, JSON.stringify(data));
    process.on('exit', () => {
        try {
            console.log('Removing watch signal file');
            fs.unlinkSync(watchSignalPath);
        } catch (e) {
            console.error('Failed to remove watch signal file', e);
        }
    });
}

export async function checkWatchSignal(baseDir: string) {
    try {
        const watchSignalPath = path.join(baseDir, '.watch-signal');
        const data = fs.readFileSync(watchSignalPath, 'utf-8');
        const { isAliveUrl } = JSON.parse(data);
        if (typeof isAliveUrl !== 'string') {
            throw new Error('Invalid watch signal file');
        }
        const res = await fetch(isAliveUrl);
        return res.status === 200;
    } catch (e) {
        return false;
    }
}
