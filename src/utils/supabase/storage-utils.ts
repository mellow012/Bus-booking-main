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

/**
 * Uploads a bus image to a Supabase storage bucket.
 * Uses a new bucket 'bus-images' or 'logos' if preferred (currently configured to use 'bus-images').
 */
export async function uploadBusImage(file: File, companyId: string, busId?: string): Promise<string> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.warn('[uploadBusImage] Unable to read authenticated user:', authError);
  }

  const ownerId = user?.id || companyId;
  const subFolder = busId || 'temp';
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${ownerId}/${subFolder}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("bus-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error('[uploadBusImage] Supabase upload error:', error, { filePath, fileType: file.type });
    const message = error.message || JSON.stringify(error);
    throw new Error(`Bus image upload failed: ${message}`);
  }

  const { data: publicData } = supabase.storage
    .from("bus-images")
    .getPublicUrl(filePath);

  return publicData.publicUrl;
}

/**
 * Uploads a profile picture to a Supabase storage bucket.
 * Uses the 'avatars' bucket.
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error('[uploadProfilePicture] Supabase upload error:', error, { filePath, fileType: file.type });
    
    // Fallback to logos bucket if avatars bucket doesn't exist
    if (error.message.includes('bucket') || error.message.includes('Bucket')) {
      console.log('Falling back to logos bucket...');
      const { data: fallbackData, error: fallbackError } = await supabase.storage
        .from("logos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
        
      if (fallbackError) {
        throw new Error(`Profile picture upload failed: ${fallbackError.message}`);
      }
      
      return supabase.storage.from("logos").getPublicUrl(filePath).data.publicUrl;
    }
    
    throw new Error(`Profile picture upload failed: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return publicData.publicUrl;
}
