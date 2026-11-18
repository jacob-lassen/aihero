import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { LessonNote, type LessonNoteData } from "./lesson-note";

function render(note: LessonNoteData) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <LessonNote note={note} /> },
  ]);
  return renderToString(<Stub />);
}

function textareaClasses(html: string): string[] {
  const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? "";
  return textarea.match(/class="([^"]*)"/)?.[1].split(/\s+/) ?? [];
}

describe("LessonNote", () => {
  it("gives the textarea a minimum and a maximum height", () => {
    const classes = textareaClasses(render(null));

    expect(classes).toContain("min-h-32");
    expect(classes).toContain("max-h-80");
    expect(classes).toContain("overflow-y-auto");
  });

  it("wraps a long unbroken word, so a pasted URL does not widen the card", () => {
    expect(textareaClasses(render(null))).toContain("wrap-anywhere");
  });

  it("puts the heading in a card header, so the card is not padded twice", () => {
    const html = render(null);

    expect(html).toMatch(/data-slot="card-header"[\s\S]*Your notes/);
    expect(html).not.toContain("pt-6");
  });

  it("shows the saved note and when it was last edited", () => {
    const html = render({
      body: "Result keeps the error in the type",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(html).toContain("Result keeps the error in the type");
    expect(html).toContain("Last edited");
  });

  it("leaves out the edit time when there is no note yet", () => {
    const html = render(null);

    expect(html).toContain("Only you can read this.");
    expect(html).not.toContain("Last edited");
  });
});
