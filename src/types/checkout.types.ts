export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

export interface ShippingAddress {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutItem {
  productId: string;
  quantity: number;
}

export type ShippingMethod = 'standard' | 'express' | 'overnight';
export type PaymentMethod = 'mock_card' | 'stripe_card' | 'adyen_card';
export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export interface CheckoutRequestPayload {
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  items: CheckoutItem[];
  currency?: CurrencyCode;
  idempotencyKey?: string;
}

export interface PricingBreakdown {
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  shippingMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
  currency: string;
}

export type AvsResultCode = 'Y' | 'A' | 'Z' | 'N' | 'U';

export interface ComplianceAudit {
  iso3166Country: string;
  iso3166Subdivision: string;
  avsCode: AvsResultCode;
  idempotencyFingerprint: string;
  twoPhaseState: 'COMMITTED' | 'ROLLED_BACK';
}

export interface CheckoutSessionResponse {
  orderId: string;
  sessionId: string;
  status: 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED';
  pricing: PricingBreakdown;
  paymentProvider: string;
  createdAt: string;
  compliance?: ComplianceAudit;
}
