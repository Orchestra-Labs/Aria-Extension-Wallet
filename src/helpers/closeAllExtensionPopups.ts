export const closeAllExtensionPopups = async () => {
  const windows = await new Promise<chrome.windows.Window[]>(res =>
    // todo use 'browser' instead of 'chrome'
    chrome.windows.getAll({ populate: false }, windows => res(windows)),
  );
  windows.forEach(async win => {
    if (win.type !== 'popup' || typeof win.id !== 'number') return;
    // todo use 'browser' instead of 'chrome'
    await chrome.windows.remove(win.id);
  });
};
