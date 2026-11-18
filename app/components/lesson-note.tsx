import { useFetcher } from "react-router";
import { NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { formatRelativeTime } from "~/lib/utils";

export type LessonNoteData = { body: string; updatedAt: string } | null;

export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  return (
    <Card className="mb-8 gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="size-4 text-muted-foreground" />
          <h2>Your notes</h2>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <fetcher.Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="save-note" />
          {/* The Textarea sizes itself to its content, which ignores `rows`.
              The bounds keep an empty note writable and a long one from
              pushing the lesson off the screen; wrap-anywhere stops a long
              unbroken word, such as a pasted URL, widening the card. */}
          <Textarea
            name="body"
            aria-label="Your notes"
            defaultValue={note?.body ?? ""}
            placeholder="Only you can read this."
            className="max-h-80 min-h-32 resize-y overflow-y-auto wrap-anywhere"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
            {!error && note && (
              <span
                suppressHydrationWarning
                className="text-xs text-muted-foreground"
              >
                Last edited {formatRelativeTime(note.updatedAt)}
              </span>
            )}
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}
