//prefer for of

interface NodeEnvironment {
    id: string;
}

export class NodeEnvManager {
    openEnvironments = new Set<NodeEnvironment>();
    closeAllEnvironments() {
        for (const env of this.openEnvironments) {
            this.closeEnvironment(env);
        }
    }
    closeEnvironment(env: NodeEnvironment) {
        this.openEnvironments.delete(env);
    }
    openEnvironment(env: NodeEnvironment) {
        this.openEnvironments.add(env);
    }
}
