import { resolve, join } from 'path';
import { parseCliArguments } from './parse-cli-arguments';
import { ForkedProcess } from './forked-process';
import { launchHttpServer } from './launch-http-server';
import { createIPC } from './process-communication';
import type { ServerOptions } from 'socket.io';

const isFirstArgumentPath = process.argv[1]!.startsWith('-');

const path = isFirstArgumentPath ? process.cwd() : process.argv[1]!;

const {
    preferredPort,
    socketServerOptions: socketServerOptionsJson,
    requiredPaths: requiredPathsJson,
} = parseCliArguments(process.argv.slice(isFirstArgumentPath ? 2 : 1));
const requiredPaths = JSON.parse(requiredPathsJson as string) as string[];

const socketServerOptions = JSON.parse(socketServerOptionsJson as string) as Partial<ServerOptions>;

const basePath = resolve(path);
// const app = new Application({ basePath, featureDiscoveryRoot: featureDiscoveryRoot as string });

const httpServerPort = preferredPort ? parseInt(preferredPort as string, 10) : undefined;

void (async () => {
    for (const requiredModule of requiredPaths) {
        try {
            await import(require.resolve(requiredModule, { paths: [basePath] }));
        } catch (ex) {
            throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
        }
    }
    const { socketServer, close, port } = await launchHttpServer({
        staticDirPath: join(basePath, 'dist'),
        httpServerPort,
        socketServerOptions,
    });

    const parentProcess = new ForkedProcess(process);
    createIPC(parentProcess, socketServer, { port, onClose: close });

    parentProcess.postMessage({ id: 'initiated' });
})();
