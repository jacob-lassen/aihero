import { FEATURED_COURSE_COUNT, takeFeatured } from "./lib/select";

export { FEATURED_COURSE_COUNT };

/**
 * The courses the home page features, from a list already in display order.
 */
export function selectFeaturedCourses<T>(courses: readonly T[]): T[] {
  return takeFeatured(courses);
}
