import parse from 'minimist';

export const kebabCaseToCamelCase = (value: string): string =>
    value.replace(/[-]\S/g, (match) => match.slice(1).toUpperCase());

export function parseCliArguments(args: string[]) {
    return Object.fromEntries(Object.entries(parse(args)).map(([key, value]) => [kebabCaseToCamelCase(key), value]));
}
