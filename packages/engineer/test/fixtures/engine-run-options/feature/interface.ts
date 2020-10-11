export class MyInterfaceClass {
    public constructor(private options: Record<string, any>) {}
    public getOptions(): Record<string, any> {
        return this.options;
    }
}
