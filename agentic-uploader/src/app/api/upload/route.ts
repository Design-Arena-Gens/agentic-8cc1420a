import { uploadShort } from "@/lib/youtube";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

const formSchema = z.object({
  title: z.string().min(5, "Title is required."),
  description: z.string().min(10, "Description is required."),
  tags: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    ),
  privacyStatus: z.enum(["public", "private", "unlisted"] as const),
  publishAt: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine(
      (value) => !value || !Number.isNaN(value.getTime()),
      "Invalid publish date.",
    )
    .transform((value) => value?.toISOString()),
  madeForKids: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  notifySubscribers: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  categoryId: z.string().optional(),
  defaultLanguage: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("video");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Video file is required." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Video file is too large." },
        { status: 400 },
      );
    }

    const payload = formSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      tags: formData.get("tags"),
      privacyStatus:
        (formData.get("privacyStatus") as string | null) ?? "private",
      publishAt: formData.get("publishAt"),
      madeForKids: formData.get("madeForKids"),
      notifySubscribers: formData.get("notifySubscribers"),
      categoryId: formData.get("categoryId"),
      defaultLanguage: formData.get("defaultLanguage"),
    });

    if (!payload.success) {
      const errorMessage = payload.error.issues
        .map((issue) => issue.message)
        .join(" ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResponse = await uploadShort({
      buffer,
      fileName: file.name,
      mimeType: file.type || "video/mp4",
      ...payload.data,
    });

    return NextResponse.json(
      {
        videoId: uploadResponse.videoId,
        url: uploadResponse.url,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Upload error", error);
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while uploading the video.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
