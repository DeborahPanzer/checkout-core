import { AvsResultCode, ShippingAddress } from '../types/checkout.types';
import { NormalizedRegion } from './Iso3166Normalizer';

export interface AvsVerificationResult {
  code: AvsResultCode;
  streetMatch: boolean;
  postalMatch: boolean;
  approved: boolean;
}

export class AvsVerifier {
  private static readonly POSTAL_PATTERNS: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
    GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
    JP: /^\d{3}-?\d{4}$/,
  };

  public verify(address: ShippingAddress, region: NormalizedRegion): AvsVerificationResult {
    if (!address.postalCode || !address.state) {
      throw new Error('US AVS validation requires state and postalCode in shippingAddress.');
    }

    const streetTrimmed = (address.address || '').trim();
    const streetMatch = streetTrimmed.length >= 5 && /\d+/.test(streetTrimmed);

    const pattern = AvsVerifier.POSTAL_PATTERNS[region.alpha2Country] ?? /^[\w\s-]{3,10}$/;
    const postalMatch = pattern.test(region.normalizedPostalCode);

    let code: AvsResultCode = 'N';
    if (streetMatch && postalMatch) {
      code = 'Y'; // Full match (Street + Postal Code)
    } else if (streetMatch && !postalMatch) {
      code = 'A'; // Street matches, Postal Code does not
    } else if (!streetMatch && postalMatch) {
      code = 'Z'; // Postal Code matches, Street does not
    }

    if (code === 'N') {
      throw new Error('AVS Declined (Code N): Neither street address nor postal code matched.');
    }

    return {
      code,
      streetMatch,
      postalMatch,
      approved: code === 'Y' || code === 'Z' || code === 'A',
    };
  }
}
