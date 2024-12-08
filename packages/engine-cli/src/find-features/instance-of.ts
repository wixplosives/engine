export type AnyClass = new (...params: any[]) => unknown;

export interface AnyInstance {
    constructor?: AnyClass;
}

export function instanceOf<T extends AnyClass>(maybeInstance: unknown, Type: T): maybeInstance is InstanceType<T> {
    return (
        maybeInstance instanceof Type ||
        (!!maybeInstance &&
            !!(maybeInstance as AnyInstance).constructor &&
            (maybeInstance as AnyInstance).constructor!.name === Type.name)
    );
}
