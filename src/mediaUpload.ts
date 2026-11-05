export const maxImageBytes = 5 * 1024 * 1024;
export const oversizedImageMessage = '이미지는 5MB 이하여야 합니다.';

export function imageUploadType(body: ArrayBuffer) {
  if (body.byteLength > maxImageBytes) throw new Error(oversizedImageMessage);
  const header = new Uint8Array(body, 0, Math.min(body.byteLength, 12));
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, index) => header[offset + index] === byte);
  if (matches([0xff, 0xd8, 0xff])) return { extension: 'jpg', contentType: 'image/jpeg' };
  if (matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { extension: 'png', contentType: 'image/png' };
  if (matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8)) {
    return { extension: 'webp', contentType: 'image/webp' };
  }
  throw new Error('JPG, PNG, WebP 이미지 파일을 선택해 주세요.');
}

export async function readImageUpload(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('사진을 읽지 못했어요. 다시 선택해 주세요.');
  const body = await response.arrayBuffer();
  return { body, ...imageUploadType(body) };
}
