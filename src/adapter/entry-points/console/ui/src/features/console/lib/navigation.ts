export const navigateReplace = (url: string): void => {
  window.location.replace(url);
};

export const navigateAssign = (url: string): void => {
  window.location.assign(url);
};

export const navigatePush = (url: string): void => {
  window.history.pushState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const navigateReplaceState = (url: string): void => {
  window.history.replaceState({}, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
