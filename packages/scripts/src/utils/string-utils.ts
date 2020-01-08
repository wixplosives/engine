/**
 * @param str A dash-separated string
 * @returns An array of lower-cased words from str
 * @example
 * getWordsFromDashedString('Dash-separated--STRING')
 * // => ['dash', 'separated', 'string']
 */
function getWordsFromDashedString(str: string) {
    return str
        .split('-')
        .map(w => w.trim().toLowerCase())
        .filter(w => w);
}

/**
 * @example
 * toCapitalCase('word')
 * // => Word
 */
export const toCapitalCase = (str: string) => str.slice(0, 1).toUpperCase() + str.slice(1);

/**
 * @param str A dash-separated string
 * @returns The kebab-cased string
 * @example
 * toKebabCase('Kebab-Case')
 * // => kebab-case
 */
export const toKebabCase = (str: string) => getWordsFromDashedString(str).join('-');

/**
 * @param str A dash-separated string
 * @returns The camel-cased string
 * @example
 * toCamelCase('Camel-Case')
 * // => camelCase
 */
export const toCamelCase = (str: string) =>
    getWordsFromDashedString(str)
        .map((w, i) => (i ? toCapitalCase(w) : w))
        .join('');

/**
 * @param obj The object to query
 * @param path The path of the property to get.
 * @returns The value at `path` of `object` id exists, `undefined` otherwise
 * @example
 * getIn({ a: { b: 'c' } }, ['a', 'b'])
 * // => c
 */
function getIn(obj: Record<string, any>, path: string[]): any {
    return path.reduce((value, key) => (value[key] !== undefined ? value[key] : undefined), obj);
}

const templateReg = /\$\{(.+?)\}/g;
/**
 * @param template A template to compile
 * @returns A compiled template function which accepts a context and return the evaluated template
 * @example
 * compileTemplate('${greetings} ${person.name}!')({ greetings: 'Hello', person: { name: 'Elad' } })
 * // => Hello Elad!
 */
export function compileTemplate(template: string) {
    return function compiledTemplate(context: { [key: string]: any }) {
        return template.replace(templateReg, (match, templateExpression: string) => {
            const pathInContext = templateExpression.trim().split('.');
            const valueInContext = getIn(context, pathInContext);
            return valueInContext !== undefined ? valueInContext : match;
        });
    };
}
