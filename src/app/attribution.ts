/** Where this visit came from: UTM tags in the URL plus the referring page. Nothing is stored on the device. */
export function attribution() {
  const p = new URLSearchParams(window.location.search);
  return {
    ref: document.referrer,
    utm: {
      source: p.get("utm_source"),
      medium: p.get("utm_medium"),
      campaign: p.get("utm_campaign"),
      content: p.get("utm_content"),
    },
  };
}
