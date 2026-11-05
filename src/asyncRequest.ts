export async function loadWithDeadline<T>(load: (signal: AbortSignal) => Promise<T>, controller: AbortController) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('연결이 오래 걸리고 있어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'));
      controller.abort();
    }, 10_000);
  });
  try { return await Promise.race([load(controller.signal), deadline]); }
  finally { clearTimeout(timer); }
}
