import type { ShadeModel } from "@shadeway/contract";

/**
 * Local stand-in for `ShadeModel.interpolateSunFraction`.
 * `@shadeway/shade-model` does not export it yet. The formula is the contract blend.
 */
export const shadeStub: Pick<ShadeModel, "interpolateSunFraction"> = {
  interpolateSunFraction(values, day) {
    const from = values[day.from];
    const to = values[day.to];
    if (from === null || to === null) return null;
    return (1 - day.t) * from + day.t * to;
  },
};
