export const openExtensionWindow = (url?: string) => {
  const extensionURL = 'index.html' + '#' + url;
  if ('chrome' in window) {
    (window.chrome as any).windows.create({
      url: extensionURL,
      type: 'popup',
      width: 420,
      height: 600,
    });
    if ('browser' in window) {
      (window.browser as any).windows.create({
        url: extensionURL,
        type: 'popup',
        width: 420,
        height: 600,
      });
    }
  }
};
