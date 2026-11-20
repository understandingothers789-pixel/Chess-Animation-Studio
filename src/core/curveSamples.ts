import type { Key } from "./project";
/** Reduce a newly sampled curve while bounding interpolation error at every sample. */
export function editableSamples(values: number[], tolerance: number): Key[] {
  const keep = new Set([0, values.length - 1]);
  function split(first: number, last: number) {
    let largest = tolerance,
      selected = -1;
    for (let i = first + 1; i < last; i++) {
      const expected =
        values[first] +
        ((values[last] - values[first]) * (i - first)) / (last - first);
      const error = Math.abs(values[i] - expected);
      if (error > largest) {
        largest = error;
        selected = i;
      }
    }
    if (selected >= 0) {
      keep.add(selected);
      split(first, selected);
      split(selected, last);
    }
  }
  split(0, values.length - 1);
  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => ({
      at: i / (values.length - 1),
      value: values[i],
      ease: "linear",
    }));
}
