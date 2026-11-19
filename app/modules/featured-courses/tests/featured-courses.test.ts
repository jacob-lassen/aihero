import { describe, it, expect } from "vitest";
import { selectFeaturedCourses } from "../index";

describe("selectFeaturedCourses", () => {
  it("takes the first four courses, in order", () => {
    expect(selectFeaturedCourses([1, 2, 3, 4, 5, 6])).toEqual([1, 2, 3, 4]);
  });

  it("returns every course when there are fewer than four", () => {
    expect(selectFeaturedCourses(["a", "b"])).toEqual(["a", "b"]);
  });

  it("returns nothing when there are no courses", () => {
    expect(selectFeaturedCourses([])).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const courses = [1, 2, 3, 4, 5];
    selectFeaturedCourses(courses);
    expect(courses).toEqual([1, 2, 3, 4, 5]);
  });
});
