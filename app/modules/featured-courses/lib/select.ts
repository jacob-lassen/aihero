// Four fills one row on desktop and a 2×2 grid on tablets, so once four
// courses are published no card sits alone on a row (issue #19: three cards
// were too big).
const FEATURED_COURSE_COUNT = 4;

// Tailwind finds classes by scanning source text, so this must stay a literal
// and change together with FEATURED_COURSE_COUNT.
export const FEATURED_GRID_COLUMNS = "lg:grid-cols-4";

export function takeFeatured<T>(courses: readonly T[]): T[] {
  return courses.slice(0, FEATURED_COURSE_COUNT);
}
