
export function assert(test: boolean): asserts test {
  if (!test) {
    throw new Error(`Assertion failed. See the stack trace for more information.`);
  }
}

export function assertNever(value: never): never {
  console.log(value);
  throw new Error(`Code was executed that should not have been run. This is a bug.`);
}

export function toArray<T>(value: undefined | T | T[]): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [ value ];
}


function isSpace(ch: string): boolean {
  return /[\s]/.test(ch)
}

export function indent(text: string, indentation = '  ', atBlankLine = true): string {
  let out = ''
  for (const ch of text) {
    if (ch === '\n') {
      atBlankLine = true;
    } else if (!isSpace(ch)) {
      if (atBlankLine) {
        out += indentation;
      }
      atBlankLine = false;
    }
    out += ch;
  }
  return out
}


function firstUpper(name: string): string {
  return name[0].toUpperCase() + name.substring(1);
}

export function camelCase(name: string): string {
  return name.split(/[-_]/).map(c => firstUpper(c)).join('');
}
