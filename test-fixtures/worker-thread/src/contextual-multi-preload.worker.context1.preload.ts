import { PreloadedGlobalThis } from './contextual-multi-preload.feature';

const preloadedGlobalThis = global as unknown as PreloadedGlobalThis;
preloadedGlobalThis.workerName = 'preloaded worker';
