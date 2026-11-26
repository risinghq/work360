export type CompanySummaryView = {
  id: string;
  ruc: string;
  legalName: string | null;
  lineOfBusiness: string | null;
  district: string | null;
  province: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  createdAt: number;
};

export type CompanyPageView = {
  rows: CompanySummaryView[];
  totalCount: number;
};

export type CompanyDetailView = CompanySummaryView & {
  address: string | null;
  people: {
    name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
  }[];
  cases: {
    id: string;
    caseTypeName: string;
    holderName: string;
    updatedAt: number;
  }[];
  activities: {
    channel: "call" | "visit";
    startedAt: number;
    userName: string;
    outcomeLabel: string | null;
    notes: string | null;
  }[];
  campaignRecords: {
    id: string;
    campaignName: string;
    segment: string;
    workedAt: number | null;
    holderName: string | null;
  }[];
};
