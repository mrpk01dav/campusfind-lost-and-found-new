import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { storage } from '../lib/firebase';
import { generateId } from '../domain';

export interface UploadResult {
  url: string | null;
  error: string | null;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Optimizes an image using an HTML5 canvas as a reliable data URI fallback
 * if Firebase Storage is unavailable or network-restricted.
 */
async function createOptimizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to process image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const storageService = {
  validateImage(file: File): string | null {
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return 'File size exceeds 5MB limit. Please choose a smaller photo.';
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Invalid file type. Supported formats are JPG, PNG, and WebP.';
    }
    return null;
  },

  async uploadFile(
    file: File,
    storagePath: string,
    onProgress?: (progressPct: number) => void,
  ): Promise<UploadResult> {
    const validationError = this.validateImage(file);
    if (validationError) {
      return { url: null, error: validationError };
    }

    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedAt: new Date().toISOString(),
        },
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      return await new Promise<UploadResult>((resolve) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0 && onProgress) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              onProgress(progress);
            }
          },
          async (error) => {
            console.warn('Firebase Storage upload failed, using high-fidelity fallback:', error);
            try {
              if (onProgress) onProgress(80);
              const dataUrl = await createOptimizedDataUrl(file);
              if (onProgress) onProgress(100);
              resolve({ url: dataUrl, error: null });
            } catch (fallbackErr: any) {
              resolve({ url: null, error: fallbackErr.message || error.message });
            }
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              if (onProgress) onProgress(100);
              resolve({ url: downloadUrl, error: null });
            } catch (urlErr: any) {
              console.warn('Could not retrieve Storage downloadURL, falling back to data URL:', urlErr);
              const dataUrl = await createOptimizedDataUrl(file);
              resolve({ url: dataUrl, error: null });
            }
          },
        );
      });
    } catch (err: any) {
      console.warn('Storage initialization error, attempting data URL fallback:', err);
      try {
        const dataUrl = await createOptimizedDataUrl(file);
        return { url: dataUrl, error: null };
      } catch (fallbackErr: any) {
        return { url: null, error: fallbackErr.message || 'Image upload failed.' };
      }
    }
  },

  async uploadItemPhoto(
    file: File,
    userId: string,
    onProgress?: (progressPct: number) => void,
  ): Promise<UploadResult> {
    const ext = file.name.split('.').pop() || 'jpg';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `items/${userId}/${Date.now()}_${generateId().slice(0, 8)}.${cleanExt}`;
    return this.uploadFile(file, path, onProgress);
  },

  async uploadProfileAvatar(
    file: File,
    userId: string,
    onProgress?: (progressPct: number) => void,
  ): Promise<UploadResult> {
    const ext = file.name.split('.').pop() || 'jpg';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `profiles/${userId}/avatar_${Date.now()}.${cleanExt}`;
    return this.uploadFile(file, path, onProgress);
  },

  async uploadClaimEvidence(
    file: File,
    claimId: string,
    userId: string,
    onProgress?: (progressPct: number) => void,
  ): Promise<UploadResult> {
    const ext = file.name.split('.').pop() || 'jpg';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'jpg';
    const path = `claims/${claimId}/${userId}_${Date.now()}.${cleanExt}`;
    return this.uploadFile(file, path, onProgress);
  },
};
