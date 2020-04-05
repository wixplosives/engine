export const kebabCaseToCamelCase = (value: string): string =>
    value.replace(/[-]\S/g, (match) => match.slice(1).toUpperCase());

export function parseCliArguments(args: string[]) {
    const argumentQueue: string[] = [];
    const options: Record<string, string | boolean> = {};
    while (args.length) {
        const currentArgument = args.shift()!;
        if (currentArgument.startsWith('--')) {
            if (argumentQueue.length) {
                options[argumentQueue.shift()!] = argumentQueue.length ? argumentQueue.join(' ') : true;
                argumentQueue.length = 0;
            }
            argumentQueue.push(kebabCaseToCamelCase(currentArgument.slice(2)));
        } else if (argumentQueue.length) {
            argumentQueue.push(currentArgument);
        } else if (args.length && !args[0].startsWith('--')) {
            args.shift();
        }
    }
    if (argumentQueue.length) {
        options[argumentQueue.shift()!] = argumentQueue.join(' ');
    }
    return options;
}
