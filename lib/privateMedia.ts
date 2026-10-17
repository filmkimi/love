import type { SupabaseClient } from "@supabase/supabase-js";

export function getStorageObjectPath(bucket: string, reference: string): string | null {
  if (reference.startsWith(`${bucket}/`)) return reference.slice(bucket.length + 1);

  try {
    const url = new URL(reference);
    const marker = `/object/public/${bucket}/`;
    const signedMarker = `/object/sign/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    const signedIndex = url.pathname.indexOf(signedMarker);
    const index = markerIndex >= 0 ? markerIndex + marker.length : signedIndex >= 0 ? signedIndex + signedMarker.length : -1;
    return index < 0 ? null : decodeURIComponent(url.pathname.slice(index));
  } catch {
    return null;
  }
}

export async function downloadPrivateMedia(
  supabase: SupabaseClient,
  bucket: string,
  reference: string
): Promise<string | null> {
  const path = getStorageObjectPath(bucket, reference);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    console.error(`Could not download private ${bucket} image:`, error.message);
    return null;
  }
  return URL.createObjectURL(data);
}
