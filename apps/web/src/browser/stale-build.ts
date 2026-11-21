// A deploy replaces the hashed chunks, so a tab opened before the deploy fails
// to import the routes it has not loaded yet. The router imports a route when
// the pointer rests on its link, well before any click, so the failure marks
// the build stale instead of reloading under a half-filled form. The next
// navigation then loads its destination as a full page, from the new build.
//
// A failure in the middle of a navigation, such as a `navigate()` call with no
// preload before it, reloads onto that navigation's destination.
const IN_FLIGHT_MS = 2_000;

export function reloadOnStaleBuild(): void {
  // Older browsers lack the Navigation API, and they reload on the failure.
  const navigation = (window as { navigation?: Navigation }).navigation;
  let stale = false;
  let leaving = false;
  let lastNavigation: { url: string; at: number } | null = null;

  // The full load fires a navigate event of its own, which must pass.
  const loadFully = (url: string) => {
    leaving = true;
    window.location.assign(url);
  };

  // The import still fails as before; `preventDefault` would resolve it with
  // undefined, which the router renders as a broken page.
  window.addEventListener("vite:preloadError", () => {
    if (!navigation) {
      window.location.reload();
      return;
    }
    stale = true;
    if (lastNavigation && Date.now() - lastNavigation.at < IN_FLIGHT_MS) {
      loadFully(lastNavigation.url);
    }
  });

  navigation?.addEventListener("navigate", (event) => {
    const url = event.destination.url;
    if (leaving) {
      return;
    }
    if (!stale || new URL(url).origin !== window.location.origin) {
      // The router replaces the entry as it settles, which moves no page.
      if (event.navigationType !== "replace") {
        lastNavigation = { url, at: Date.now() };
      }
      return;
    }
    if (event.navigationType === "reload") {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    loadFully(url);
  });
}
