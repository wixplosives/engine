namespace globalThis {
    // used by communication to determine the type of environment
    // we want to avoid having @types/node in engine-core
    const process: { title?: string; type?: string } | undefined;
}
