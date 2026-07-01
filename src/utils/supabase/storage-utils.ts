// src/utils/supabase/storage-utils.ts
import { createClient } from "./client";

/**
 * Uploads a file to a Supabase storage bucket.
 * Bucket 'logos' must exist and have public access or appropriate RLS.
 */
export async function uploadLogo(file: File, companyId: string): Promise<string> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.warn('[uploadLogo] Unable to read authenticated user:', authError);
  }

  const ownerId = user?.id || companyId;
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${ownerId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("logos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error('[uploadLogo] Supabase upload error:', error, { filePath, fileType: file.type });
    const message = error.message || JSON.stringify(error);
    throw new Error(`Logo upload failed: ${message}`);
  }

  const { data: publicData } = supabase.storage
    .from("logos")
    .getPublicUrl(filePath);

  return publicData.publicUrl;
}
