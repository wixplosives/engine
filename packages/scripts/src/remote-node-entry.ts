import { resolve } from 'path';
import { Application } from './application';
import { parseCliArguments } from './utils';

const isFirstArgumentPath = process.argv[1]!.startsWith('-');

const path = isFirstArgumentPath ? process.cwd() : process.argv[1]!;

const { preferredPort, featureDiscoveryRoot } = parseCliArguments(process.argv.slice(isFirstArgumentPath ? 2 : 1));

const basePath = resolve(path);
const app = new Application({ basePath, featureDiscoveryRoot: featureDiscoveryRoot as string });
const port = preferredPort ? parseInt(preferredPort as string, 10) : undefined;
app.remote({ port }).catch((e) => {
    console.error(e);
    process.exit(1);
});
