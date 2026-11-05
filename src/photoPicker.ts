import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { maxImageBytes, oversizedImageMessage, readImageUpload } from './mediaUpload';

export function usePhotoPicker() {
  const request = useRef(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const clearError = useCallback(() => setError(''), []);

  const choose = async (onSelected: (uri: string) => void | Promise<void>) => {
    if (request.current) return;
    request.current = true;
    setChecking(true);
    try {
      // Preserve the original type so a GIF cannot silently become a PNG.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('사진을 읽지 못했어요. 다시 선택해 주세요.');
      if (asset.fileSize != null && asset.fileSize > maxImageBytes) throw new Error(oversizedImageMessage);
      await readImageUpload(asset.uri);
      await onSelected(asset.uri);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '사진을 열지 못했어요. 다시 선택해 주세요.');
    } finally {
      request.current = false;
      setChecking(false);
    }
  };

  return { choose, checking, error, clearError };
}
