/// <reference types="vite/client" />

interface Window {
  __shadeway?: {
    places: readonly { name: string; at: readonly [number, number] }[];
    pick(at: readonly [number, number]): void;
    route(from: readonly [number, number], to: readonly [number, number], minutes: number): Promise<unknown>;
  };
}
