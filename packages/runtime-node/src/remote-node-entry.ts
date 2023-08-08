import { resolve, join } from 'path';
import { parseCliArguments } from './parse-cli-arguments.js';
import { ForkedProcess } from './forked-process.js';
import { launchEngineHttpServer } from './launch-http-server.js';
import { createIPC } from './process-communication.js';
import type { ServerOptions } from 'socket.io';

const {
    preferredPort,
    socketServerOptions: socketServerOptionsJson,
    requiredPaths: requiredPathsJson,
    _: [providedPath = process.cwd()],
} = parseCliArguments(process.argv.slice(1));
const requiredPaths = JSON.parse(requiredPathsJson as string) as string[];

const socketServerOptions = JSON.parse(socketServerOptionsJson as string) as Partial<ServerOptions>;

const basePath = resolve(providedPath);

const httpServerPort = preferredPort ? parseInt(preferredPort as string, 10) : undefined;

(async () => {
    for (const requiredModule of requiredPaths) {
        try {
            await import(require.resolve(requiredModule, { paths: [basePath] }));
        } catch (ex) {
            throw new Error(`failed importing: ${requiredModule}`, { cause: ex });
        }
    }
    const { socketServer, close, port } = await launchEngineHttpServer({
        staticDirPath: join(basePath, 'dist'),
        httpServerPort,
        socketServerOptions,
    });

    const parentProcess = new ForkedProcess(process);
    createIPC(parentProcess, socketServer, { port, onClose: close });

    parentProcess.postMessage({ id: 'initiated' });
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
