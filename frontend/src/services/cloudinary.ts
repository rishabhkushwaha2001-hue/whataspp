import * as ImageManipulator from 'expo-image-manipulator';

const DEFAULT_CLOUD_NAME = 'dtyyymnny';
const DEFAULT_UPLOAD_PRESET = 'ml_default';

/**
 * Uploads an image to Cloudinary.
 * In React Native / Expo SDK 57+, `fetch` with `FormData` often fails because of the
 * WinterCG-compliant fetch polyfill. We solve this by:
 * 1. Preferring Base64 JSON upload (`application/json`), which is 100% reliable across all OS.
 * 2. Falling back to `XMLHttpRequest` with `FormData`, which bypasses the fetch polyfill.
 */
export const uploadToCloudinary = async (
  imageUriOrBase64: string,
  cloudName: string = DEFAULT_CLOUD_NAME,
  uploadPreset: string = DEFAULT_UPLOAD_PRESET
): Promise<string | null> => {
  if (!imageUriOrBase64) {
    console.error('uploadToCloudinary: empty image URI or base64 passed');
    return null;
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // Strategy 1: Upload via Base64 JSON (Most reliable in Expo SDK 52+ / RN 0.80+)
  try {
    let base64Data = '';

    if (imageUriOrBase64.startsWith('data:image')) {
      base64Data = imageUriOrBase64;
    } else if (/^[A-Za-z0-9+/=]+$/.test(imageUriOrBase64.slice(0, 100))) {
      base64Data = `data:image/jpeg;base64,${imageUriOrBase64}`;
    } else {
      // It's a local file URI (e.g. file:// or content://)
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          imageUriOrBase64,
          [{ resize: { width: 350, height: 350 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (manipulated.base64) {
          base64Data = `data:image/jpeg;base64,${manipulated.base64}`;
        }
      } catch (manipErr) {
        console.warn('Could not extract base64 via ImageManipulator:', manipErr);
      }
    }

    if (base64Data) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          file: base64Data,
          upload_preset: uploadPreset,
        }),
      });

      const result = await res.json();
      if (res.ok && result.secure_url) {
        return result.secure_url;
      }
      console.warn('Cloudinary JSON upload did not return secure_url:', result);
    }
  } catch (jsonErr) {
    console.warn('Cloudinary JSON upload failed, trying XHR fallback:', jsonErr);
  }

  // Strategy 2: Fallback to XMLHttpRequest with FormData (Bypasses Expo fetch polyfill)
  try {
    const filename = imageUriOrBase64.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    const data = new FormData();
    data.append('file', {
      uri: imageUriOrBase64,
      name: filename,
      type,
    } as any);
    data.append('upload_preset', uploadPreset);

    const result = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint);
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (e) {
          reject(new Error(`Failed to parse XHR response: ${xhr.responseText}`));
        }
      };
      xhr.onerror = (e) => reject(e);
      xhr.ontimeout = () => reject(new Error('Cloudinary upload timed out'));
      xhr.timeout = 45000;
      xhr.send(data);
    });

    if (result && result.secure_url) {
      return result.secure_url;
    }
    console.error('Cloudinary XHR upload failed:', result);
    return null;
  } catch (xhrErr) {
    console.error('All Cloudinary upload attempts failed:', xhrErr);
    return null;
  }
};

