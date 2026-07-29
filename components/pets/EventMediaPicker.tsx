"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  MAX_EVENT_MEDIA_FILES,
  validateEventMediaFiles,
} from "@/lib/pet-event-media";

export default function EventMediaPicker({
  files,
  onChange,
  existingCount = 0,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existingCount?: number;
}) {
  const [error, setError] = useState("");

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video/"),
      })),
    [files],
  );

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews],
  );

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";

    const nextFiles = [...files, ...selected];
    const validationError = validateEventMediaFiles(
      nextFiles,
      existingCount,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    onChange(nextFiles);
  }

  function removeFile(index: number) {
    const next = files.filter((_, currentIndex) => currentIndex !== index);
    onChange(next);
    setError("");
  }

  const remaining = Math.max(
    0,
    MAX_EVENT_MEDIA_FILES - existingCount - files.length,
  );

  return (
    <div>
      <div className="rounded-2xl border border-dashed border-[#cfc8ba] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-[#153f34]">사진·영상 첨부</p>
            <p className="mt-1 text-sm text-[#727872]">
              사진 10MB, 영상 50MB 이하 · 최대 {MAX_EVENT_MEDIA_FILES}개
            </p>
          </div>

          <label className="cursor-pointer rounded-full bg-[#153f34] px-4 py-2 text-sm font-bold text-white">
            파일 선택
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
              multiple
              disabled={remaining === 0}
              onChange={handleFiles}
              className="hidden"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-[#8b908c]">
          새로 {remaining}개 더 선택할 수 있습니다.
        </p>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((preview, index) => (
            <div
              key={`${preview.file.name}-${index}`}
              className="overflow-hidden rounded-2xl border border-[#e4dfd4] bg-white"
            >
              <div className="aspect-square bg-black/5">
                {preview.isVideo ? (
                  <video
                    src={preview.url}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-xs text-[#656b66]">
                  {preview.file.name}
                </p>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="mt-2 text-xs font-bold text-red-600"
                >
                  선택 취소
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
