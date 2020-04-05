export class CodeService {
    public content = '';
    private handlers: Array<() => void> = [];
    public setContent(c: string) {
        this.content = c;
        this.handlers.forEach((fn) => fn());
    }
    public getContent() {
        return this.content;
    }
    public listen(handler: () => void) {
        this.handlers.push(handler);
    }
}
