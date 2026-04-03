import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns the index of the value in `values` closest to `target`. */
export function getNearestIndex(values: number[], target: number): number {
  let bestIdx = 0;
  let bestDiff = Infinity;
  values.forEach((val, idx) => {
    const diff = Math.abs(val - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}
