import { supabase } from "@/lib/supabase";

export const PET_EVENT_MEDIA_BUCKET = "pet-health-events";
export const MAX_EVENT_MEDIA_FILES = 5;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export type EventAttachment = {
  id: number;
  event_id: number;
  pet_id: number;
  storage_path: string;
  file_name: string;
  mime_type: string;
  media_type: "image" | "video";
  size_bytes: number | null;
  sort_order: number;
  signed_url?: string;
};

export function getMediaType(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export function validateEventMediaFiles(
  files: File[],
  existingCount = 0,
): string | null {
  if (existingCount + files.length > MAX_EVENT_MEDIA_FILES) {
    return `사진과 영상은 이벤트당 최대 ${MAX_EVENT_MEDIA_FILES}개까지 첨부할 수 있습니다.`;
  }

  for (const file of files) {
    const mediaType = getMediaType(file);

    if (!mediaType) {
      return `${file.name}: 사진 또는 영상 파일만 첨부할 수 있습니다.`;
    }

    if (mediaType === "image" && file.size > MAX_IMAGE_SIZE_BYTES) {
      return `${file.name}: 사진은 파일당 10MB 이하만 가능합니다.`;
    }

    if (mediaType === "video" && file.size > MAX_VIDEO_SIZE_BYTES) {
      return `${file.name}: 영상은 파일당 50MB 이하만 가능합니다.`;
    }
  }

  return null;
}

function sanitizeFileName(fileName: string) {
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop()?.toLowerCase()}`
    : "";

  return `${crypto.randomUUID()}${extension}`;
}

export async function uploadEventMedia({
  files,
  userId,
  petId,
  eventId,
  startSortOrder = 0,
}: {
  files: File[];
  userId: string;
  petId: number;
  eventId: number;
  startSortOrder?: number;
}) {
  const uploadedPaths: string[] = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const mediaType = getMediaType(file);

      if (!mediaType) {
        throw new Error(`${file.name}은 지원하지 않는 파일 형식입니다.`);
      }

      const storagePath = `${userId}/${petId}/${eventId}/${sanitizeFileName(
        file.name,
      )}`;

      const { error: uploadError } = await supabase.storage
        .from(PET_EVENT_MEDIA_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(storagePath);

      const { error: rowError } = await supabase
        .from("pet_health_event_attachments")
        .insert({
          event_id: eventId,
          pet_id: petId,
          user_id: userId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          media_type: mediaType,
          size_bytes: file.size,
          sort_order: startSortOrder + index,
        });

      if (rowError) throw rowError;
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage
        .from(PET_EVENT_MEDIA_BUCKET)
        .remove(uploadedPaths);
    }

    throw error;
  }
}

export async function loadSignedEventAttachments(eventIds: number[]) {
  if (eventIds.length === 0) return [] as EventAttachment[];

  const { data, error } = await supabase
    .from("pet_health_event_attachments")
    .select(
      "id,event_id,pet_id,storage_path,file_name,mime_type,media_type,size_bytes,sort_order",
    )
    .in("event_id", eventIds)
    .order("sort_order")
    .order("created_at");

  if (error) throw error;

  const attachments = (data as EventAttachment[] | null) ?? [];

  return Promise.all(
    attachments.map(async (attachment) => {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(PET_EVENT_MEDIA_BUCKET)
        .createSignedUrl(attachment.storage_path, 60 * 60);

      return {
        ...attachment,
        signed_url: signedError ? undefined : signedData.signedUrl,
      };
    }),
  );
}

export async function deleteEventAttachment(
  attachment: Pick<EventAttachment, "id" | "storage_path">,
) {
  const { error: storageError } = await supabase.storage
    .from(PET_EVENT_MEDIA_BUCKET)
    .remove([attachment.storage_path]);

  if (storageError) throw storageError;

  const { error: rowError } = await supabase
    .from("pet_health_event_attachments")
    .delete()
    .eq("id", attachment.id);

  if (rowError) throw rowError;
}
