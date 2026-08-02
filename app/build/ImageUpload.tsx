"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ImageAnswer } from "@/lib/intake";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/**
 * Uploads straight to the private `intake` bucket from the browser.
 *
 * Not through a server action: the file would have to be serialised into the
 * action payload and back out again, for no benefit — RLS on `storage.objects`
 * enforces the per-user folder either way, and the browser client can't write
 * outside `<user_id>/`.
 *
 * The checks below are a courtesy so the user gets a useful message instead of
 * a 400. The bucket's own `file_size_limit` and `allowed_mime_types` are what
 * actually hold.
 */
export default function ImageUpload({
  value,
  onChange,
}: {
  value: ImageAnswer | undefined;
  onChange: (v: ImageAnswer | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("That's over 5 MB. A phone photo scaled down is plenty.");
      return;
    }
    if (file.type && !ACCEPTED.includes(file.type)) {
      setError("Images only — JPEG, PNG, WebP or HEIC.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You've been signed out. Reload and try again.");
        return;
      }

      // Keep the extension (storage infers content type from it in some
      // clients) but never trust the rest of the filename in a path.
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const path = `${user.id}/inspo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("intake")
        .upload(path, file, { upsert: true, contentType: file.type || undefined });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setPreview(URL.createObjectURL(file));
      onChange({ path, filename: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const current = value;
    onChange(undefined);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    if (!current) return;
    try {
      const supabase = createClient();
      await supabase.storage.from("intake").remove([current.path]);
    } catch {
      // The row is already detached from the intake; a stray object in the
      // user's own private folder is not worth blocking the form over.
    }
  }

  if (value) {
    return (
      <div className="rounded-xl border border-line bg-panel2 p-3">
        <div className="flex items-center gap-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Your reference photo"
              className="size-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel text-2xl">
              🖼️
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{value.filename}</p>
            <p className="text-xs text-faint">Uploaded · private to you</p>
          </div>
          <button
            type="button"
            onClick={remove}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-hot"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-panel2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
      />
      {busy && <p className="mt-2 text-xs text-faint">Uploading…</p>}
      {error && (
        <p className="mt-2 rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
