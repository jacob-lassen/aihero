import { LessonProgressStatus } from "~/db/schema";
import { useEffect } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import type { Route } from "../routes/+types/courses.$slug.lessons.$lessonId";
import { CommentThread } from "~/components/comment-thread";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { CheckCircle2, ChevronRight, Clock, Github } from "lucide-react";
import { formatDuration } from "~/lib/utils";
import { YouTubePlayer } from "~/components/youtube-player";
import { LessonNote } from "~/components/lesson-note";
import { LessonBreadcrumb } from "~/components/lesson-breadcrumb";
import { CurriculumSidebar } from "~/components/curriculum-sidebar";
import { QuizSection } from "~/components/quiz-section";
import { BookmarkToggle } from "~/components/bookmark-toggle";
import { LessonPager } from "~/components/lesson-pager";
import { useAutoplay } from "~/components/use-autoplay";

type FullData = Extract<Route.ComponentProps["loaderData"], { view: "full" }>;

export function FullLesson({ data }: { data: FullData }) {
  const { course, lesson, enrolled, currentUserId, nextLesson } = data;

  return (
    <div className="flex">
      {/* Curriculum Sidebar */}
      <CurriculumSidebar
        course={course}
        curriculum={data.curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={data.lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={data.module}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          <LessonHeader data={data} />
          <LessonBody data={data} />

          {/* Quiz Section */}
          {enrolled && currentUserId && <LessonQuiz data={data} />}

          {/* Mark Complete / Up Next */}
          {enrolled && currentUserId && <LessonCompletion data={data} />}

          {/* Questions & Discussion — confidential to people with access */}
          <CommentThread
            comments={data.comments}
            currentUserId={currentUserId}
            canModerate={data.canModerate}
            canPost
            instructorName={data.instructorName}
          />

          <LessonPager
            course={course}
            prevLesson={data.prevLesson}
            nextLesson={nextLesson}
          />
        </div>
      </div>
    </div>
  );
}

function LessonHeader({ data }: { data: FullData }) {
  const { lesson } = data;

  return (
    <>
      {/* Lesson Title */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {data.currentUserId && <BookmarkToggle bookmarked={data.bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonBody({ data }: { data: FullData }) {
  const { lesson, contentHtml, currentUserId } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();

  return (
    <>
      {/* YouTube Video */}
      {lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={lesson.videoUrl}
          lessonId={lesson.id}
          title={lesson.title}
          startPosition={data.lastWatchPosition}
          durationMinutes={lesson.durationMinutes}
          watchProgress={data.watchProgress}
          trackingEnabled={data.enrolled && !!currentUserId}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
        />
      )}

      {/* Note — under the video, so the Student can write while they watch */}
      {currentUserId && <LessonNote note={data.note} />}

      {/* Lesson Content */}
      {contentHtml && (
        <div
          className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
          // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {!contentHtml && !lesson.videoUrl && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No content has been added to this lesson yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}

function LessonCompletion({ data }: { data: FullData }) {
  const { course, lesson, nextLesson } = data;
  const fetcher = useFetcher({ key: `mark-complete-${lesson.id}` });
  const navigate = useNavigate();

  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";
  const justCompleted = fetcher.data?.success;
  const isCompleted =
    data.lessonStatus === LessonProgressStatus.Completed || justCompleted;

  // Navigate to next lesson after marking complete
  useEffect(() => {
    if (justCompleted && nextLesson) {
      navigate(`/courses/${course.slug}/lessons/${nextLesson.id}`);
    }
  }, [justCompleted, nextLesson, course.slug, navigate]);

  return (
    <div className="mb-8">
      {isCompleted ? (
        <LessonCompleted courseSlug={course.slug} nextLesson={nextLesson} />
      ) : (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="mark-complete" />
          {nextLesson ? (
            <Button disabled={isMarking}>
              {isMarking ? (
                "Completing..."
              ) : (
                <>
                  Up next: {nextLesson.title}
                  <ChevronRight className="ml-1 size-4" />
                </>
              )}
            </Button>
          ) : (
            <Button disabled={isMarking}>
              <CheckCircle2 className="mr-2 size-4" />
              {isMarking ? "Marking..." : "Mark as Complete"}
            </Button>
          )}
        </fetcher.Form>
      )}
    </div>
  );
}

function LessonCompleted({
  courseSlug,
  nextLesson,
}: {
  courseSlug: string;
  nextLesson: FullData["nextLesson"];
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${courseSlug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function LessonQuiz({ data }: { data: FullData }) {
  const quizFetcher = useFetcher({ key: `quiz-${data.lesson.id}` });
  if (!data.quiz) return null;

  return (
    <QuizSection
      quiz={data.quiz}
      bestAttempt={data.bestAttempt}
      quizResult={quizFetcher.data?.quizResult ?? null}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
    />
  );
}
