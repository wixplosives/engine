export class EnvironmentDisconnectedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EnvironmentDisconnectedError';
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
