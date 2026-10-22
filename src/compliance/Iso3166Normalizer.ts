import { ShippingAddress } from '../types/checkout.types';

export interface NormalizedRegion {
  alpha2Country: string;
  isoSubdivision: string;
  normalizedPostalCode: string;
}

export class Iso3166Normalizer {
  private static readonly COUNTRY_MAP: Record<string, string> = {
    US: 'US', USA: 'US', 'UNITED STATES': 'US',
    GB: 'GB', GBR: 'GB', UK: 'GB', 'UNITED KINGDOM': 'GB',
    CA: 'CA', CAN: 'CA', CANADA: 'CA',
    DE: 'DE', DEU: 'DE', GERMANY: 'DE',
    FR: 'FR', FRA: 'FR', FRANCE: 'FR',
    JP: 'JP', JPN: 'JP', JAPAN: 'JP',
    VN: 'VN', VNM: 'VN', VIETNAM: 'VN',
  };

  private static readonly US_STATES = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ]);

  public normalize(address: ShippingAddress): NormalizedRegion {
    const rawCountry = (address.country || 'US').trim().toUpperCase();
    const alpha2Country = Iso3166Normalizer.COUNTRY_MAP[rawCountry];

    if (!alpha2Country) {
      throw new Error(`ISO-3166 Violation: Unsupported or invalid country code '${address.country}'.`);
    }

    const rawState = (address.state || '').trim().toUpperCase();
    if (!rawState) {
      throw new Error('ISO-3166 Violation: Subdivision/state is required.');
    }

    if (alpha2Country === 'US' && !Iso3166Normalizer.US_STATES.has(rawState)) {
      throw new Error(`ISO-3166-2 Violation: '${rawState}' is not a valid US state code.`);
    }

    return {
      alpha2Country,
      isoSubdivision: `${alpha2Country}-${rawState}`,
      normalizedPostalCode: (address.postalCode || '').trim().toUpperCase(),
    };
  }
}
