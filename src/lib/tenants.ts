/** First-party client sites hosted on the Nexora domain: /{client-slug} */

export const TMU = {
  slug: "tmu-investments",
  name: "TMU Investments",
  product: "Cash Loans",
} as const;

export const TMU_ROOT = `/${TMU.slug}`;
export const TMU_PORTAL = `${TMU_ROOT}/portal`;

export const tmuPortal = {
  home: TMU_PORTAL,
  login: `${TMU_PORTAL}/login`,
  register: `${TMU_PORTAL}/register`,
  apply: `${TMU_PORTAL}/apply`,
} as const;

/** Logos and photos from nexora-cash-loan-services */
export const tmuAssets = {
  horizontal: "/tmu/nexora-horizontal.png",
  stacked: "/tmu/nexora-stacked.png",
  office: "/tmu/loan-office.jpg",
} as const;
