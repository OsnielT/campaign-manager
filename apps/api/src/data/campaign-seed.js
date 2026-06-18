function addDays(baseDate, days) {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function toIsoString(date, hours = 9) {
  const copy = new Date(date);
  copy.setHours(hours, 0, 0, 0);
  return copy.toISOString();
}

const now = new Date();

export const campaignSeed = [
  {
    slug: "spring-launch-spotlight",
    name: "Spring Launch Spotlight",
    startDate: toIsoString(addDays(now, -10), 8),
    endDate: toIsoString(addDays(now, 12), 22),
    pages: [
      {
        id: "spring-launch-home",
        type: "landing",
        title: "Spring Launch Landing",
        path: "/spring-launch-spotlight/",
        next: "spring-launch-product-alpha"
      },
      {
        id: "spring-launch-product-alpha",
        type: "product",
        title: "Alpha Product Page",
        path: "/spring-launch-spotlight/products/alpha",
        next: "spring-launch-offer-bundle"
      },
      {
        id: "spring-launch-offer-bundle",
        type: "offer",
        title: "Bundle Offer",
        path: "/spring-launch-spotlight/offers/bundle",
        next: null
      }
    ]
  },
  {
    slug: "summer-preview-series",
    name: "Summer Preview Series",
    startDate: toIsoString(addDays(now, 6), 8),
    endDate: toIsoString(addDays(now, 24), 22),
    pages: [
      {
        id: "summer-preview-home",
        type: "landing",
        title: "Summer Preview Landing",
        path: "/summer-preview-series/",
        next: "summer-preview-offer"
      },
      {
        id: "summer-preview-offer",
        type: "offer",
        title: "Early Access Offer",
        path: "/summer-preview-series/offers/early-access",
        next: null
      }
    ]
  },
  {
    slug: "winter-closeout-event",
    name: "Winter Closeout Event",
    startDate: toIsoString(addDays(now, -40), 8),
    endDate: toIsoString(addDays(now, -8), 22),
    pages: [
      {
        id: "winter-closeout-home",
        type: "landing",
        title: "Winter Closeout Landing",
        path: "/winter-closeout-event/",
        next: "winter-closeout-product"
      },
      {
        id: "winter-closeout-product",
        type: "product",
        title: "Clearance Product Page",
        path: "/winter-closeout-event/products/clearance",
        next: null
      }
    ]
  },
  {
    slug: "evergreen-growth-engine",
    name: "Evergreen Growth Engine",
    startDate: toIsoString(addDays(now, -4), 8),
    endDate: toIsoString(addDays(now, 45), 22),
    pages: [
      {
        id: "evergreen-home",
        type: "landing",
        title: "Evergreen Landing",
        path: "/evergreen-growth-engine/",
        next: "evergreen-product-core"
      },
      {
        id: "evergreen-product-core",
        type: "product",
        title: "Core Platform Product",
        path: "/evergreen-growth-engine/products/core-platform",
        next: "evergreen-product-add-on"
      },
      {
        id: "evergreen-product-add-on",
        type: "product",
        title: "Add-On Product",
        path: "/evergreen-growth-engine/products/add-on",
        next: "evergreen-offer-upgrade"
      },
      {
        id: "evergreen-offer-upgrade",
        type: "offer",
        title: "Upgrade Incentive",
        path: "/evergreen-growth-engine/offers/upgrade",
        next: null
      }
    ]
  }
];
