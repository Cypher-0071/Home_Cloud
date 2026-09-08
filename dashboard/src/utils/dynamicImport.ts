/**
 * Detects if an error is caused by a failed dynamic import or network failure
 * when fetching code-split chunks (e.g. offline, server redeployment, CDN hiccup).
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  let message: string;
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
  } else if (
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    const name =
      'name' in error && typeof (error as { name: unknown }).name === 'string'
        ? (error as { name: string }).name
        : 'Error';
    message = `${name}: ${(error as { message: string }).message}`;
  } else {
    message = String(error);
  }

  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /loading chunk [\w.-]+ failed/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /failed to load module script/i.test(message) ||
    /unable to preload css/i.test(message) ||
    /net::err_/i.test(message) ||
    /load failed/i.test(message) ||
    /networkerror/i.test(message) ||
    /failed to fetch/i.test(message)
  );
}

/**
 * Retries a dynamic import function with exponential backoff.
 * Defaults to 2 retries (3 attempts total) with exponential backoff.
 *
 * @param importer Factory function returning the import promise
 * @param retriesLeft Number of retry attempts remaining (default: 2)
 * @param intervalMs Initial retry delay in milliseconds (default: 1000)
 */
export async function retryDynamicImport<T>(
  importer: () => Promise<T>,
  retriesLeft = 2,
  intervalMs = 1000
): Promise<T> {
  try {
    return await importer();
  } catch (error) {
    if (retriesLeft <= 0) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    return retryDynamicImport(importer, retriesLeft - 1, intervalMs * 2);
  }
}
