export const uploadToCloudinary = async (imageUri: string, cloudName: string, uploadPreset: string): Promise<string | null> => {
  try {
    const data = new FormData();
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    data.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    data.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: data,
    });

    const result = await res.json();
    if (result.secure_url) {
      return result.secure_url;
    }
    
    console.error('Cloudinary upload failed:', result);
    return null;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return null;
  }
};
