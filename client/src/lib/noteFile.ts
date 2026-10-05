import { supabase } from "@/lib/supabase";

const STORAGE_BUCKET = "notes-pdfs";

/**
 * Extract the object path (e.g. "<userId>/file.pdf") from a stored public URL
 * like ".../storage/v1/object/public/notes-pdfs/<userId>/file.pdf".
 */
export function storagePathFromUrl(url: string): string | null {
    const marker = `/${STORAGE_BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return null;
    try {
        return decodeURIComponent(url.slice(i + marker.length));
    } catch {
        return url.slice(i + marker.length);
    }
}

/**
 * Turn a stored note URL into one that will actually load.
 *
 * The value saved on the row is an /object/public/ link, which 400s while the bucket
 * is private, so this mints a short-lived signed URL with the logged-in client. Falls
 * back to the stored URL when signing isn't possible (public bucket, or an expired
 * session) — that still works in the public case and fails visibly in the other.
 *
 * Shared by the note reader and the lesson's Notes drawer so the two cannot drift.
 */
export async function resolveNoteFileUrl(storedUrl: string | null): Promise<string | null> {
    if (!storedUrl) return null;
    const path = storagePathFromUrl(storedUrl);
    if (!path) return storedUrl;
    try {
        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(path, 60 * 60);
        if (error) {
            console.warn("Could not create signed URL, using stored URL:", error);
            return storedUrl;
        }
        return data?.signedUrl ?? storedUrl;
    } catch (err) {
        console.warn("Could not create signed URL, using stored URL:", err);
        return storedUrl;
    }
}

/** pdf.js throws on a JPEG, so image notes have to render as plain <img>. */
export function isImageNote(fileName: string | null | undefined): boolean {
    return /\.(jpe?g|png|webp)$/i.test(fileName || "");
}
