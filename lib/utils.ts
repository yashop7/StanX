import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS classes intelligently, removing duplicates
 * and resolving conflicts in favor of the last value
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
