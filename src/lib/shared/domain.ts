export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type JobStatus =
  | 'awaiting_payment'
  | 'payment_pending'
  | 'paid'
  | 'running'
  | 'ready'
  | 'interrupted'
  | 'failed';
export type SourceSegment = { id: string; text: string };
export type TranslationSegment = { id: string; text: string };

export type CheckoutTerms = {
  chainId: number;
  checkoutAddress: Address;
  tokenAddress: Address;
  tokenDecimals: number;
  amountAtomic: string;
  merchantAddress: Address;
  serviceId: Hex;
  termsHash: Hex;
};

export type WorkshopView = {
  entityKey: Hex;
  ownerAddress: Address;
  title: string;
  description: string;
  active: boolean;
  sourceLang: 'en';
  targetLang: 'hi';
  jobType: 'text.translate';
  checkoutChainId: number;
  checkoutAddress: Address;
  serviceId: Hex;
  termsHash: Hex;
  expiresAtBlock: string | null;
  fetchedAt: string;
  freshness: 'fresh' | 'stale';
  supported: boolean;
};

export type PaymentView = {
  txHash: Hex;
  status: 'submitted' | 'verified';
  blockNumber: string | null;
  verifiedAt: string | null;
};

export type InferenceEvidence = {
  requestId: string | null;
  modelId: string | null;
  providerId: string | null;
  routingTier: string | null;
  verificationRequested: boolean;
  routerTeeVerified: boolean | null;
};

export type JobView = {
  id: Hex;
  buyerAddress: Address;
  workshopEntityKey: Hex;
  sourceLang: 'en';
  targetLang: 'hi';
  status: JobStatus;
  sourceSegments: SourceSegment[];
  terms: CheckoutTerms;
  payment: PaymentView | null;
  modelSegments: TranslationSegment[] | null;
  editedSegments: TranslationSegment[] | null;
  evidence: InferenceEvidence | null;
  attemptsUsed: number;
  retryEligible: boolean;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type JobSummary = Pick<
  JobView,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'sourceLang' | 'targetLang'
>;

export type ToolCityPayProps = {
  job: JobView;
  onJobChange: (job: JobView) => void;
};

export type MerchantPurchase = {
  jobId: Hex;
  buyerAddress: Address;
  merchantAddress: Address;
  serviceId: Hex;
  txHash: Hex;
  blockNumber: string;
  verifiedAt: string;
  chainId: number;
  tokenAddress: Address;
  amountAtomic: string;
};

export type PublicConfig = {
  schemaVersion: 1;
  configured: boolean;
  appNamespace: string;
  sourceLang: 'en';
  targetLang: 'hi';
  maxWords: 250;
  maxChars: 5000;
  arkiv: { chainId: number; rpcUrl: string; explorerUrl: string };
  whitechain: {
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    tokenAddress: Address;
  };
  terms: CheckoutTerms | null;
  serviceTermsText: string;
};
