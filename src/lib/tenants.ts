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
  account: `${TMU_PORTAL}/account`,
} as const;

export const tmuContact = {
  phone: "+264 85 218 3350",
  landline: "+264 61 225 801",
  email: "tmuinvestment@outlook.com",
  address: "Independence Avenue, Windhoek, Namibia",
} as const;

export const tmuTel = (n: string) => `tel:${n.replace(/\s/g, "")}`;
export const tmuWhatsApp = `https://wa.me/${tmuContact.phone.replace(/[^\d]/g, "")}`;

/** TMU Holdings brand assets (tenant-specific; Nexora house brand stays on /) */
export const tmuAssets = {
  logo: "/tmu/tmu-holdings-logo.png",
  horizontal: "/tmu/tmu-holdings-logo.png",
  stacked: "/tmu/tmu-holdings-logo.png",
  office: "/tmu/loan-office.jpg",
} as const;
