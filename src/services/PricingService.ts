import { CheckoutItem, PricingBreakdown, ShippingMethod } from '../types/checkout.types';

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
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid item quantity for product '${item.productId}'. Must be a positive integer.`);
      }
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
