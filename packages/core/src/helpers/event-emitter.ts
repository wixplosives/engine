import { SetMultiMap } from './set-multi-map';

export type EventListener<T> = (event: T) => void;

export class EventEmitter<T extends {}> {
    public listeners = new SetMultiMap<keyof T, EventListener<any>>();
    public listenersOnce = new SetMultiMap<keyof T, EventListener<any>>();

    public on<K extends keyof T>(eventName: K, listener: EventListener<T[K]>) {
        this.listeners.add(eventName, listener);
    }

    public subscribe<K extends keyof T>(eventName: K, listener: EventListener<T[K]>) {
        this.on(eventName, listener);
    }

    public once<K extends keyof T>(eventName: K, listener: EventListener<T[K]>) {
        this.listenersOnce.add(eventName, listener);
    }

    public off<K extends keyof T>(eventName: K, listener: EventListener<T[K]>) {
        this.listeners.delete(eventName, listener);
        this.listenersOnce.delete(eventName, listener);
    }

    public unsubscribe<K extends keyof T>(eventName: K, listener: EventListener<T[K]>) {
        this.off(eventName, listener);
    }

    public emit<K extends keyof T>(eventName: K, eventValue: T[K]) {
        const listeners = this.listeners.get(eventName);
        if (listeners) {
            for (const listener of listeners) {
                listener(eventValue);
            }
        }
        const listenersOnce = this.listenersOnce.get(eventName);
        if (listenersOnce) {
            for (const listener of listenersOnce) {
                listener(eventValue);
            }
            this.listenersOnce.deleteKey(eventName);
        }
    }

    public clear() {
        this.listeners.clear();
        this.listenersOnce.clear();
    }
}
