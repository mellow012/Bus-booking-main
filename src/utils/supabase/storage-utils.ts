// src/utils/supabase/storage-utils.ts
import { createClient } from "./client";

/**
 * Uploads a file to a Supabase storage bucket.
 * Bucket 'logos' must exist and have public access or appropriate RLS.
 */
export async function uploadLogo(file: File, companyId: string): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split(".").pop();
  const fileName = `${companyId}/${Date.now()}.${fileExt}`;
  const filePath = fileName;

  const { data, error } = await supabase.storage
    .from("logos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("logos")
    .getPublicUrl(filePath);

  return publicUrl;
}
