/**
 * The collection of items that expires items on the specified expiration timeout.
 */
export class ExpirableList<T> {
    private items: { item: T; timestamp: number }[] = [];

    /**
     * @param expirationTimeMilliseconds the time to live for items in milliseconds
     */
    constructor(private expirationTimeMilliseconds: number) {}

    /**
     * Adds new item to a collection
     */
    public push(item: T): void {
        this.removeExpiredItems();
        this.items.push({
            item,
            timestamp: performance.now(),
        });
    }

    /**
     * @returns the list of non-expired items
     */
    public getItems(): T[] {
        this.removeExpiredItems();
        return this.items.map(({ item }) => item);
    }

    private removeExpiredItems() {
        const currentTimestamp = performance.now();
        this.items = this.items.filter(
            ({ timestamp }) => timestamp + this.expirationTimeMilliseconds > currentTimestamp
        );
    }
}
