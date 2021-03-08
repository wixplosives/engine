// used by communication to determine the type of environment
// we want to avoid having @types/node in engine-core
// eslint-disable-next-line no-var

declare module 'process' {
    const process: { title?: string; type?: string; versions?: { node?: string } };
    export = process;
}
