'use client';

import { useCallback, useMemo, useState } from "react";

type QueueStatus = "draft" | "ready" | "scheduled" | "uploaded";

interface QueueItem {
  id: string;
  title: string;
  publishAt?: string;
  status: QueueStatus;
  url?: string;
}

interface UploadResult {
  videoId: string;
  url: string;
}

const COMMON_SKIP = new Set([
  "the",
  "and",
  "with",
  "your",
  "that",
  "this",
  "from",
  "about",
  "shorts",
  "video",
  "youtube",
]);

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function safeToISOString(date: Date | undefined) {
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildPublishDate(date: string, time: string) {
  if (!date) return undefined;
  const fallbackTime = time || "09:00";
  const iso = new Date(`${date}T${fallbackTime}:00`);
  return safeToISOString(iso);
}

function extractHashtags(input: string) {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.startsWith("#"))
    .map((tag) => tag.replace(/[^a-z0-9_]/g, ""))
    .filter(Boolean);
}

function generateHashtags(title: string, description: string, tags: string) {
  const tokens = `${title} ${description} ${tags}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !COMMON_SKIP.has(word));

  const histogram = new Map<string, number>();

  for (const token of tokens) {
    histogram.set(token, (histogram.get(token) ?? 0) + 1);
  }

  const ranked = [...histogram.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => `#${word.replace(/[^a-z0-9]/g, "")}`);

  const inline = extractHashtags(description).slice(0, 3);
  const deduped = [...new Set([...inline, ...ranked])];

  return deduped.slice(0, 8);
}

function recommendedHook(title: string) {
  if (!title.trim()) {
    return [
      "Hook the viewer within the first second.",
      "Show the end result first, then rewind.",
      "End on a punchy CTA that fits the story.",
    ];
  }

  const hook = title.split(/\b/)[0]?.toUpperCase() ?? "NEW";
  return [
    `Open with an on-screen caption: "${hook} in 30 seconds".`,
    "Cut to your strongest visual immediately.",
    "Layer upbeat music under the first three seconds.",
  ];
}

export default function Page() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState(
    () => process.env.NEXT_PUBLIC_DEFAULT_HASHTAGS ?? "",
  );
  const [privacyStatus, setPrivacyStatus] = useState<"private" | "public" | "unlisted">("private");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [madeForKids, setMadeForKids] = useState(false);
  const [notifySubscribers, setNotifySubscribers] = useState(false);
  const [categoryId, setCategoryId] = useState("24");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const autoHashtags = useMemo(
    () => generateHashtags(title, description, tagsInput).join(", "),
    [title, description, tagsInput],
  );

  const hookTips = useMemo(() => recommendedHook(title), [title]);

  const addToQueue = useCallback(() => {
    const publishAt = buildPublishDate(scheduleDate, scheduleTime);
    setQueue((prev) => [
      ...prev,
      {
        id: randomId(),
        title: title || "Untitled Short",
        publishAt,
        status: publishAt ? "scheduled" : "draft",
      },
    ]);
  }, [scheduleDate, scheduleTime, title]);

  const syncTagsWithHashtags = () => {
    if (!tagsInput.trim()) {
      setTagsInput(autoHashtags);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setTagsInput("");
    setPrivacyStatus("private");
    setScheduleDate("");
    setScheduleTime("");
    setMadeForKids(false);
    setNotifySubscribers(false);
    setCategoryId("24");
    setDefaultLanguage("en");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError("Attach a Short before uploading.");
      return;
    }

    const publishAt = buildPublishDate(scheduleDate, scheduleTime);
    if (publishAt && privacyStatus === "public") {
      setError("Scheduled Shorts must use private or unlisted privacy until publish time.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("video", file);
      formData.append("title", title);
      formData.append("description", description);
      formData.append("tags", tagsInput);
      formData.append("privacyStatus", privacyStatus);
      if (publishAt) {
        formData.append("publishAt", publishAt);
      }
      formData.append("madeForKids", String(madeForKids));
      formData.append("notifySubscribers", String(notifySubscribers));
      formData.append("categoryId", categoryId);
      formData.append("defaultLanguage", defaultLanguage);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Upload failed.");
      }

      const data = (await response.json()) as UploadResult;
      setResult(data);
      setQueue((prev) =>
        prev.map((item) =>
          !item.url && title && item.title === title
            ? { ...item, status: "uploaded", url: data.url }
            : item,
        ),
      );
      resetForm();
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        setError(uploadError.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-transparent pb-24">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 pb-12 pt-16 lg:px-10">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.35em] text-indigo-300">
            ShortShift Agent
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Upload, optimize, and schedule your YouTube Shorts in one flow.
          </h1>
          <p className="max-w-2xl text-sm text-slate-200/70 sm:text-base">
            Connect your Shorts pipeline, auto-generate metadata, and deploy straight to your channel.
            Provide your Google API credentials in the environment to enable direct uploads.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-200/60">
          <span className="rounded-full border border-white/10 px-3 py-1">
            OAuth refresh token support
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Scheduling aware metadata
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Auto hashtag curator
          </span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 lg:grid-cols-[2fr_1fr] lg:px-10">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur lg:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="flex items-center justify-between text-sm text-slate-200/70">
                <span>Short file</span>
                <span className="text-xs text-slate-200/40">
                  MP4, MOV, WEBM · &lt; 1 GB
                </span>
              </label>
              <div className="mt-2 rounded-xl border border-dashed border-indigo-300/40 bg-indigo-500/5 p-4">
                <input
                  accept="video/mp4,video/webm,video/quicktime"
                  type="file"
                  className="w-full text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-500/10 file:px-4 file:py-2 file:text-indigo-100 file:font-medium hover:file:bg-indigo-500/20"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0];
                    setFile(nextFile ?? null);
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                  placeholder="Drop the hook in the first 45 characters"
                  required
                />
              </label>

              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Default language
                </span>
                <input
                  value={defaultLanguage}
                  onChange={(event) => setDefaultLanguage(event.target.value)}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                  placeholder="en"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={6}
                className="resize-none rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm leading-relaxed text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                placeholder="Outline the payoff, the CTA, and add chapter-style timestamps if relevant."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Hashtags & Tags
                  <button
                    type="button"
                    onClick={syncTagsWithHashtags}
                    className="rounded-lg border border-indigo-300/40 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-500/20"
                  >
                    Auto fill
                  </button>
                </span>
                <input
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                  placeholder="#shorts, #howto, productivity"
                />
                <p className="text-xs text-indigo-100/60">
                  Suggested: {autoHashtags || "add keywords to unlock suggestions"}
                </p>
              </label>

              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Category
                </span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                >
                  <option value="24">Entertainment</option>
                  <option value="22">People & Blogs</option>
                  <option value="23">Comedy</option>
                  <option value="26">Howto & Style</option>
                  <option value="27">Education</option>
                  <option value="28">Science & Tech</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Privacy
                </span>
                <select
                  value={privacyStatus}
                  onChange={(event) =>
                    setPrivacyStatus(event.target.value as "private" | "public" | "unlisted")
                  }
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Schedule Date
                </span>
                <input
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  type="date"
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                />
              </label>

              <label className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-white/5 p-4">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-200/80">
                  Schedule Time
                </span>
                <input
                  value={scheduleTime}
                  onChange={(event) => setScheduleTime(event.target.value)}
                  type="time"
                  className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-400 focus:bg-indigo-500/10"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-indigo-100/70">
                <span>Is this made for kids?</span>
                <input
                  type="checkbox"
                  checked={madeForKids}
                  onChange={(event) => setMadeForKids(event.target.checked)}
                  className="h-5 w-5 rounded border border-indigo-300/40 bg-transparent text-indigo-400 focus:outline-none focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-indigo-100/70">
                <span>Notify subscribers</span>
                <input
                  type="checkbox"
                  checked={notifySubscribers}
                  onChange={(event) => setNotifySubscribers(event.target.checked)}
                  className="h-5 w-5 rounded border border-indigo-300/40 bg-transparent text-indigo-400 focus:outline-none focus:ring-0"
                />
              </label>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                {error}
              </p>
            )}

            {result && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Uploaded successfully!{" "}
                <a
                  className="underline decoration-emerald-300/80 underline-offset-4"
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on YouTube
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-500/60"
              >
                {uploading ? "Uploading…" : "Upload Short"}
              </button>
              <button
                type="button"
                onClick={addToQueue}
                className="rounded-full border border-indigo-300/60 bg-indigo-500/10 px-6 py-3 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
              >
                Add to Launch Plan
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200/80 transition hover:border-white/30"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur lg:p-8">
          <div>
            <h2 className="text-lg font-semibold text-white">Launch Intelligence</h2>
            <p className="mt-2 text-xs text-slate-200/60">
              Lightweight heuristics to keep each Short sticky and bingeable.
            </p>
          </div>

          <section className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-100/80">
                Hook Strategy
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-200/70">
                {hookTips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-indigo-300" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-100/80">
                Launch Queue ({queue.length})
              </h3>
              <div className="mt-3 space-y-3">
                {queue.length === 0 && (
                  <p className="text-sm text-slate-200/50">
                    Add Shorts to your launch plan to pre-stage metadata and schedule windows.
                  </p>
                )}
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-slate-100/80"
                  >
                    <p className="font-semibold text-white">{item.title}</p>
                    {item.publishAt ? (
                      <p className="text-xs text-indigo-100/60">
                        Scheduled for {new Date(item.publishAt).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-xs text-indigo-100/60">Draft • needs schedule</p>
                    )}
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-200/40">
                      {item.status}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs font-semibold text-emerald-200 underline underline-offset-4"
                      >
                        View Short
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-100/80">
                Credential Checklist
              </h3>
              <ol className="mt-3 space-y-2 text-xs text-slate-200/60">
                <li>
                  1. Create a{" "}
                  <span className="text-indigo-200">
                    Web application OAuth client (YouTube Data API v3)
                  </span>{" "}
                  in Google Cloud.
                </li>
                <li>
                  2. Exchange your OAuth credentials for a refresh token and store it as{" "}
                  <code className="rounded bg-black/40 px-1.5 py-0.5 text-[10px]">YOUTUBE_REFRESH_TOKEN</code>.
                </li>
                <li>
                  3. Add <code className="rounded bg-black/40 px-1.5 py-0.5 text-[10px]">YOUTUBE_CLIENT_ID</code>{" "}
                  and{" "}
                  <code className="rounded bg-black/40 px-1.5 py-0.5 text-[10px]">YOUTUBE_CLIENT_SECRET</code>{" "}
                  to your env, then redeploy.
                </li>
              </ol>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
