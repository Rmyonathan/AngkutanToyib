"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
};

/**
 * Mobile camera/gallery upload.
 * Saves via `/api/upload/local` → `public/uploads/field` (MVP, no external key).
 * UploadThing route (`/api/uploadthing`) is ready — switch UI to `UploadButton`
 * from `@/lib/uploadthing` when UPLOADTHING_TOKEN is configured.
 */
export function PhotoUploadField({ label, hint, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setLoading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload/local", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal");
      onChange(data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-neutral-900">{label}</p>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
        {value && (
          <button
            type="button"
            className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
            onClick={() => onChange(null)}
            aria-label="Hapus foto"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="max-h-56 w-full object-contain bg-neutral-50"
          />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 text-[11px] text-white">
            <Check className="h-3 w-3" /> Terunggah
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-100",
            loading && "opacity-60"
          )}
        >
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : (
            <Camera className="h-10 w-10" />
          )}
          <span className="text-sm font-medium">
            {loading ? "Mengunggah…" : "Ambil / Pilih Foto"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {error && <p className="mt-2 text-sm text-neutral-900">{error}</p>}
    </div>
  );
}
