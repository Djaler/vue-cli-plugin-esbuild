import stripComments from 'strip-comments';

export function hasDecorator(fileContent: string, decorators?: string[]): boolean {
    let decoratorsPattern: string;
    if (decorators) {
        decoratorsPattern = `(${decorators.join('|')})`;
    } else {
        decoratorsPattern = '[\\w\\d]+';
    }
    const regexp = new RegExp(`(?<![(\\s]\\s*['"])@${decoratorsPattern}\\s+`);

    return regexp.test(stripComments(fileContent));
}
