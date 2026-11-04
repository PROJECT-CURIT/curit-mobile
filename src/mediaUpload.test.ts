import { describe, expect, it } from 'vitest';
import { imageUploadType } from './mediaUpload';

describe('image upload validation', () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  it('identifies supported file types from bytes, not names', () => {
    expect(imageUploadType(Uint8Array.from(png).buffer).contentType).toBe('image/png');
    expect(imageUploadType(Uint8Array.from([255, 216, 255]).buffer).extension).toBe('jpg');
    expect(imageUploadType(new TextEncoder().encode('RIFF....WEBP').buffer).extension).toBe('webp');
  });

  it('rejects empty, unsupported and malformed headers', () => {
    for (const body of [new ArrayBuffer(0), new TextEncoder().encode('%PDF-1.7').buffer, Uint8Array.from(png.slice(0, 7)).buffer]) {
      expect(() => imageUploadType(body)).toThrow('JPG, PNG, WebP');
    }
  });

  it('allows exactly 5 MiB and rejects the next byte', () => {
    const body = new Uint8Array(5 * 1024 * 1024);
    body.set(png);
    expect(imageUploadType(body.buffer).extension).toBe('png');
    expect(() => imageUploadType(new ArrayBuffer(body.byteLength + 1))).toThrow('5MB');
  });
});
