import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PagerLesson = { id: number; title: string } | null;

export function LessonPager({
  course,
  prevLesson,
  nextLesson,
}: {
  course: { slug: string; title: string };
  prevLesson: PagerLesson;
  nextLesson: PagerLesson;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {prevLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
          className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          <PagerLabel caption="Previous" title={prevLesson.title} />
        </Link>
      ) : (
        <div />
      )}

      {nextLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
          className="flex items-center gap-2 text-right text-sm hover:text-foreground text-muted-foreground"
        >
          <PagerLabel caption="Next" title={nextLesson.title} />
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <Link
          to={`/courses/${course.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <PagerLabel caption="Back to" title={course.title} />
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function PagerLabel({ caption, title }: { caption: string; title: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{caption}</div>
      <div className="font-medium text-foreground">{title}</div>
    </div>
  );
}
