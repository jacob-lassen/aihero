import { FEATURED_GRID_COLUMNS, takeFeatured } from "./lib/select";

/**
 * The desktop column class for the featured grid: one column per featured
 * course, so the selection always fills exactly one row.
 */
export { FEATURED_GRID_COLUMNS };

/**
 * The courses the home page features, from a list already in display order.
 */
export function selectFeaturedCourses<T>(courses: readonly T[]): T[] {
  return takeFeatured(courses);
}
