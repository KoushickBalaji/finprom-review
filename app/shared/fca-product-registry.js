const define = (definition) => Object.freeze({
  ...definition,
  principalSourcebooks: Object.freeze([...definition.principalSourcebooks]),
});

export const FCA_PRODUCT_GROUPS = Object.freeze([
  Object.freeze({ id: "investments_pensions", label: "Investments and pensions" }),
  Object.freeze({ id: "banking_payments", label: "Banking and payments" }),
  Object.freeze({ id: "credit_home_finance", label: "Credit and home finance" }),
  Object.freeze({ id: "insurance_protection", label: "Insurance and protection" }),
  Object.freeze({ id: "specialist_services", label: "Specialist regulated services" }),
]);

// Product families are derived from the FCA Handbook's customer-facing conduct
// and specialist sourcebooks. They are deliberately not a list of every FCA
// sourcebook: prudential, supervision, enforcement and market-infrastructure
// manuals are not products a marketer can select.
export const FCA_PRODUCTS = Object.freeze([
  define({ id: "investments", label: "Retail investments", group: "investments_pensions", principalSourcebooks: ["COBS"], ticketPrefix: "INV" }),
  define({ id: "collective_investment_schemes", label: "Collective investment schemes", group: "investments_pensions", principalSourcebooks: ["COBS", "COLL"], ticketPrefix: "CIS" }),
  define({ id: "investment_funds", label: "Investment funds", group: "investments_pensions", principalSourcebooks: ["COBS", "FUND"], ticketPrefix: "FUND" }),
  define({ id: "pensions", label: "Pensions and retirement products", group: "investments_pensions", principalSourcebooks: ["COBS"], ticketPrefix: "PEN" }),
  define({ id: "peer_to_peer_agreements", label: "Peer-to-peer agreements", group: "investments_pensions", principalSourcebooks: ["COBS"], ticketPrefix: "P2P" }),
  define({ id: "qualifying_cryptoassets", label: "Qualifying cryptoassets", group: "investments_pensions", principalSourcebooks: ["COBS"], ticketPrefix: "CRYP" }),
  define({ id: "consumer_composite_investments", label: "Consumer composite investments", group: "investments_pensions", principalSourcebooks: ["COBS", "DISC"], ticketPrefix: "CCI" }),
  define({ id: "esg_investments", label: "Sustainability-labelled investments", group: "investments_pensions", principalSourcebooks: ["COBS", "ESG", "PROD"], ticketPrefix: "ESG" }),
  define({ id: "insurance_based_investments", label: "Insurance-based investment products", group: "investments_pensions", principalSourcebooks: ["COBS"], ticketPrefix: "IBIP" }),

  define({ id: "retail_banking", label: "Retail banking services", group: "banking_payments", principalSourcebooks: ["BCOBS"], ticketPrefix: "BANK" }),
  define({ id: "deposits_savings", label: "Deposits and savings accounts", group: "banking_payments", principalSourcebooks: ["BCOBS"], ticketPrefix: "DEP" }),
  define({ id: "structured_deposits", label: "Structured deposits", group: "banking_payments", principalSourcebooks: ["BCOBS", "COBS", "DISC"], ticketPrefix: "SDEP" }),
  define({ id: "payment_services_emoney", label: "Payment services and electronic money", group: "banking_payments", principalSourcebooks: ["BCOBS"], ticketPrefix: "PAY" }),
  define({ id: "cash_access_services", label: "Cash access services", group: "banking_payments", principalSourcebooks: ["ATCS", "BCOBS"], ticketPrefix: "CASH" }),

  define({ id: "consumer_credit", label: "Consumer credit", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "CC" }),
  define({ id: "motor_finance", label: "Motor finance", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "MFIN" }),
  define({ id: "credit_cards", label: "Credit cards and revolving credit", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "CARD" }),
  define({ id: "high_cost_credit", label: "High-cost credit", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "HCC" }),
  define({ id: "consumer_hire", label: "Consumer hire and hire purchase", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "HIRE" }),
  define({ id: "credit_broking", label: "Credit broking", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "CBRK" }),
  define({ id: "debt_services", label: "Debt counselling and debt adjusting", group: "credit_home_finance", principalSourcebooks: ["CONC"], ticketPrefix: "DEBT" }),
  define({ id: "mortgages", label: "Mortgages", group: "credit_home_finance", principalSourcebooks: ["MCOB"], ticketPrefix: "MORT" }),
  define({ id: "equity_release", label: "Equity release and home reversion", group: "credit_home_finance", principalSourcebooks: ["MCOB"], ticketPrefix: "EQREL" }),
  define({ id: "home_purchase_plans", label: "Home purchase plans", group: "credit_home_finance", principalSourcebooks: ["MCOB"], ticketPrefix: "HPP" }),
  define({ id: "sale_and_rent_back", label: "Sale and rent back agreements", group: "credit_home_finance", principalSourcebooks: ["MCOB"], ticketPrefix: "SRB" }),
  define({ id: "credit_union_savings", label: "Credit union savings", group: "credit_home_finance", principalSourcebooks: ["CREDS", "BCOBS"], ticketPrefix: "CUS" }),
  define({ id: "credit_union_lending", label: "Credit union lending", group: "credit_home_finance", principalSourcebooks: ["CREDS", "CONC"], ticketPrefix: "CUL" }),
  define({ id: "credit_union_mortgages", label: "Credit union mortgages", group: "credit_home_finance", principalSourcebooks: ["CREDS", "MCOB"], ticketPrefix: "CUM" }),

  define({ id: "non_investment_insurance", label: "Non-investment insurance", group: "insurance_protection", principalSourcebooks: ["ICOBS"], ticketPrefix: "INS" }),
  define({ id: "general_insurance", label: "General insurance", group: "insurance_protection", principalSourcebooks: ["ICOBS"], ticketPrefix: "GI" }),
  define({ id: "pure_protection", label: "Pure protection products", group: "insurance_protection", principalSourcebooks: ["ICOBS"], ticketPrefix: "PROT" }),

  define({ id: "claims_management", label: "Claims management services", group: "specialist_services", principalSourcebooks: ["CMCOB"], ticketPrefix: "CMC" }),
  define({ id: "funeral_plans", label: "Funeral plans", group: "specialist_services", principalSourcebooks: ["FPCOB"], ticketPrefix: "FP" }),
  define({ id: "pensions_dashboards", label: "Pensions dashboard services", group: "specialist_services", principalSourcebooks: ["PDCOB"], ticketPrefix: "PDB" }),
]);

export const FCA_PRODUCT_IDS = Object.freeze(FCA_PRODUCTS.map(({ id }) => id));
export const FCA_PRODUCT_BY_ID = new Map(FCA_PRODUCTS.map((product) => [product.id, product]));
export const PRODUCT_LABELS = Object.freeze(Object.fromEntries(
  FCA_PRODUCTS.map(({ id, label }) => [id, label]),
));
export const PRODUCT_SOURCEBOOKS = Object.freeze(Object.fromEntries(
  FCA_PRODUCTS.map(({ id, principalSourcebooks }) => [id, principalSourcebooks]),
));
export const PRODUCT_TICKET_PREFIXES = Object.freeze(Object.fromEntries(
  FCA_PRODUCTS.map(({ id, ticketPrefix }) => [id, ticketPrefix]),
));

export function getFcaProduct(productId) {
  return FCA_PRODUCT_BY_ID.get(productId) ?? null;
}

export function groupedFcaProducts() {
  return FCA_PRODUCT_GROUPS.map((group) => ({
    ...group,
    products: FCA_PRODUCTS.filter((product) => product.group === group.id),
  }));
}

