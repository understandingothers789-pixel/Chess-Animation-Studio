/** Return the first index satisfying a monotonic predicate, or the array length. */
export function firstMatchingIndex<T>(
  items: readonly T[],
  matches: (item: T) => boolean,
) {
  let start = 0;
  let end = items.length;
  while (start < end) {
    const middle = start + Math.floor((end - start) / 2);
    if (matches(items[middle])) end = middle;
    else start = middle + 1;
  }
  return start;
}
