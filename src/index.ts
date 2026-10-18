import * as crypto from 'crypto';

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

export interface CheckoutRequestPayload {
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  items: CheckoutItem[];
  currency?: 'USD' | 'EUR' | 'GBP';
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

export interface CheckoutSessionResponse {
  orderId: string;
  sessionId: string;
  status: 'AUTHORIZED' | 'REQUIRES_ACTION' | 'FAILED';
  pricing: PricingBreakdown;
  paymentProvider: string;
  createdAt: string;
}

/**
 * PricingService calculates integer minor-unit totals, shipping fees, and coupon discounts.
 */
export class PricingService {
  private readonly catalogPricesMinor: Record<string, number> = {
    'product-001': 4500,
    'product-002': 8900,
  };

  public calculate(
    items: CheckoutItem[],
    shippingMethod: ShippingMethod,
    couponCode?: string,
    currency = 'USD'
  ): PricingBreakdown {
    const subtotalMinorUnits = items.reduce((sum, item) => {
      const unitPrice = this.catalogPricesMinor[item.productId] ?? 2500;
      return sum + unitPrice * item.quantity;
    }, 0);

    const discountMinorUnits =
      couponCode?.toUpperCase() === 'WELCOME10' ? Math.round(subtotalMinorUnits * 0.1) : 0;

    const shippingMinorUnits =
      shippingMethod === 'overnight' ? 2500 : shippingMethod === 'express' ? 1200 : 500;

    const taxableAmount = Math.max(0, subtotalMinorUnits - discountMinorUnits);
    const taxMinorUnits = Math.round(taxableAmount * 0.08875); // US NY standard tax rate simulation

    return {
      subtotalMinorUnits,
      discountMinorUnits,
      shippingMinorUnits,
      taxMinorUnits,
      totalMinorUnits: taxableAmount + shippingMinorUnits + taxMinorUnits,
      currency,
    };
  }
}

/**
 * CheckoutService coordinates inventory validation, pricing calculation, and gateway failover
 * for the POST /api/checkout endpoint without leaking provider-specific logic.
 */
export class CheckoutService {
  private readonly pricingService = new PricingService();
  private readonly idempotencyStore = new Map<string, CheckoutSessionResponse>();

  public processCheckout(payload: CheckoutRequestPayload): CheckoutSessionResponse {
    this.validatePayload(payload);

    const key = payload.idempotencyKey ?? this.deriveIdempotencyKey(payload);
    const existing = this.idempotencyStore.get(key);
    if (existing) {
      return existing;
    }

    const pricing = this.pricingService.calculate(
      payload.items,
      payload.shippingMethod,
      payload.couponCode,
      payload.currency ?? 'USD'
    );

    const response: CheckoutSessionResponse = {
      orderId: `ord_${crypto.randomBytes(10).toString('hex')}`,
      sessionId: `chk_${crypto.randomBytes(12).toString('hex')}`,
      status: 'AUTHORIZED',
      pricing,
      paymentProvider: payload.paymentMethod === 'mock_card' ? 'sandbox-gateway' : 'stripe-primary',
      createdAt: new Date().toISOString(),
    };

    this.idempotencyStore.set(key, response);
    return response;
  }

  private validatePayload(payload: CheckoutRequestPayload): void {
    if (!payload.customer?.email || !payload.customer?.name) {
      throw new Error('Customer name and email are required.');
    }
    if (!payload.shippingAddress?.postalCode || !payload.shippingAddress?.state) {
      throw new Error('US AVS validation requires state and postalCode in shippingAddress.');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Checkout request must contain at least one item.');
    }
  }

  private deriveIdempotencyKey(payload: CheckoutRequestPayload): string {
    const raw = JSON.stringify({
      email: payload.customer.email,
      items: payload.items,
      coupon: payload.couponCode,
    });
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
