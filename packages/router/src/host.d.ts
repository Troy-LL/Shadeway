declare const console: { log(...args: readonly unknown[]): void };
declare const performance: { now(): number };
declare const TextDecoder: new () => { decode(input: Uint8Array): string };
declare const TextEncoder: new () => { encode(input: string): Uint8Array };
