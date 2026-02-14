export const STORAGE_REFRESH_EVENT = 'zynq:storage-refresh';

export function emitStorageRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STORAGE_REFRESH_EVENT));
}
