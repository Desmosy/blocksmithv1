/**
 * BlockSmith Capture — service worker.
 *
 * MV3 requires a background worker for the action to be installable; all
 * capture logic lives in the popup (user-gesture context, required by
 * chrome.tabs.captureVisibleTab). Kept intentionally empty.
 */
chrome.runtime.onInstalled.addListener(() => {
  // no-op
});
