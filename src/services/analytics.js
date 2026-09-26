const scriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
const allowedDomains = import.meta.env.VITE_UMAMI_DOMAINS || 'compactindo.com';

export const initAnalytics = () => {
  if (!scriptUrl || !websiteId || document.querySelector('script[data-website-id]')) {
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = scriptUrl;
  script.dataset.websiteId = websiteId;
  script.dataset.domains = allowedDomains;
  script.dataset.doNotTrack = 'true';
  script.dataset.performance = 'true';
  document.head.appendChild(script);
};

export const trackAnalyticsEvent = (name, data) => {
  if (typeof window.umami?.track === 'function') {
    window.umami.track(name, data);
  }
};
