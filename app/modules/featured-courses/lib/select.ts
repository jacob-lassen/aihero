// Four fills one row on desktop and a 2×2 grid on tablets, so no card sits
// alone on a row (issue #19: three cards were too big).
export const FEATURED_COURSE_COUNT = 4;

export function takeFeatured<T>(courses: readonly T[]): T[] {
  return courses.slice(0, FEATURED_COURSE_COUNT);
}
