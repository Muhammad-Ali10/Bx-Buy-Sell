/**
 * Utility to detect country from city/location name
 * Maps common cities to their countries for flag display
 */

// US States mapping
export const usStatesToCountry: { [key: string]: string } = {
  'alabama': 'USA',
  'alaska': 'USA',
  'arizona': 'USA',
  'arkansas': 'USA',
  'california': 'USA',
  'colorado': 'USA',
  'connecticut': 'USA',
  'delaware': 'USA',
  'florida': 'USA',
  'georgia': 'USA',
  'hawaii': 'USA',
  'idaho': 'USA',
  'illinois': 'USA',
  'indiana': 'USA',
  'iowa': 'USA',
  'kansas': 'USA',
  'kentucky': 'USA',
  'louisiana': 'USA',
  'maine': 'USA',
  'maryland': 'USA',
  'massachusetts': 'USA',
  'michigan': 'USA',
  'minnesota': 'USA',
  'mississippi': 'USA',
  'missouri': 'USA',
  'montana': 'USA',
  'nebraska': 'USA',
  'nevada': 'USA',
  'new hampshire': 'USA',
  'new jersey': 'USA',
  'new mexico': 'USA',
  'new york': 'USA',
  'north carolina': 'USA',
  'north dakota': 'USA',
  'ohio': 'USA',
  'oklahoma': 'USA',
  'oregon': 'USA',
  'pennsylvania': 'USA',
  'rhode island': 'USA',
  'south carolina': 'USA',
  'south dakota': 'USA',
  'tennessee': 'USA',
  'texas': 'USA',
  'utah': 'USA',
  'vermont': 'USA',
  'virginia': 'USA',
  'washington': 'USA',
  'west virginia': 'USA',
  'wisconsin': 'USA',
  'wyoming': 'USA',
  'district of columbia': 'USA',
  'dc': 'USA',
};

export const cityToCountryMap: { [key: string]: string } = {
  // Pakistan cities
  'multan': 'Pakistan',
  'karachi': 'Pakistan',
  'lahore': 'Pakistan',
  'islamabad': 'Pakistan',
  'faisalabad': 'Pakistan',
  'rawalpindi': 'Pakistan',
  'peshawar': 'Pakistan',
  'quetta': 'Pakistan',
  'sialkot': 'Pakistan',
  'gujranwala': 'Pakistan',
  // 'hyderabad': 'Pakistan', // Also in India; keep single mapping below
  
  // India cities
  'mumbai': 'India',
  'delhi': 'India',
  'bangalore': 'India',
  'kolkata': 'India',
  'chennai': 'India',
  'hyderabad': 'India', // Note: Also in Pakistan, but more common in India
  'pune': 'India',
  'ahmedabad': 'India',
  'jaipur': 'India',
  'surat': 'India',
  'lucknow': 'India',
  'kanpur': 'India',
  'nagpur': 'India',
  'indore': 'India',
  'thane': 'India',
  'bhopal': 'India',
  'visakhapatnam': 'India',
  'patna': 'India',
  'vadodara': 'India',
  'gurgaon': 'India',
  'noida': 'India',
  'goa': 'India',
  
  // USA cities
  'new york': 'USA',
  'los angeles': 'USA',
  'chicago': 'USA',
  'houston': 'USA',
  'phoenix': 'USA',
  'philadelphia': 'USA',
  'san antonio': 'USA',
  'san diego': 'USA',
  'dallas': 'USA',
  'san jose': 'USA',
  'austin': 'USA',
  'jacksonville': 'USA',
  'san francisco': 'USA',
  'boston': 'USA',
  'seattle': 'USA',
  'miami': 'USA',
  'washington': 'USA',
  'atlanta': 'USA',
  'denver': 'USA',
  'las vegas': 'USA',
  
  // UK cities
  'london': 'UK',
  'birmingham': 'UK',
  'manchester': 'UK',
  'glasgow': 'UK',
  'liverpool': 'UK',
  'leeds': 'UK',
  'sheffield': 'UK',
  'edinburgh': 'UK',
  'bristol': 'UK',
  'cardiff': 'UK',
  
  // Canada cities
  'toronto': 'Canada',
  'vancouver': 'Canada',
  'montreal': 'Canada',
  'calgary': 'Canada',
  'ottawa': 'Canada',
  'edmonton': 'Canada',
  'winnipeg': 'Canada',
  'quebec': 'Canada',
  
  // Australia cities
  'melbourne': 'Australia',
  'brisbane': 'Australia',
  'perth': 'Australia',
  'adelaide': 'Australia',
  'gold coast': 'Australia',
  'newcastle': 'Australia',
  'canberra': 'Australia',
  
  // Singapore
  'singapore': 'Singapore',
  
  // UAE cities
  'dubai': 'UAE',
  'abu dhabi': 'UAE',
  'sharjah': 'UAE',
  
  // Other major cities
  'tokyo': 'Japan',
  'seoul': 'South Korea',
  'beijing': 'China',
  'shanghai': 'China',
  'hong kong': 'Hong Kong',
  'bangkok': 'Thailand',
  'kuala lumpur': 'Malaysia',
  'jakarta': 'Indonesia',
  'manila': 'Philippines',
  'ho chi minh': 'Vietnam',
  'hanoi': 'Vietnam',
  'sydney': 'Australia',
  'auckland': 'New Zealand',
  'paris': 'France',
  'berlin': 'Germany',
  'madrid': 'Spain',
  'rome': 'Italy',
  'amsterdam': 'Netherlands',
  'brussels': 'Belgium',
  'vienna': 'Austria',
  'zurich': 'Switzerland',
  'stockholm': 'Sweden',
  'oslo': 'Norway',
  'copenhagen': 'Denmark',
  'helsinki': 'Finland',
  'dublin': 'Ireland',
  'lisbon': 'Portugal',
  'athens': 'Greece',
  'warsaw': 'Poland',
  'prague': 'Czech Republic',
  'budapest': 'Hungary',
  'bucharest': 'Romania',
  'sofia': 'Bulgaria',
  'moscow': 'Russia',
  'istanbul': 'Turkey',
  'cairo': 'Egypt',
  'johannesburg': 'South Africa',
  'lagos': 'Nigeria',
  'nairobi': 'Kenya',
  'riyadh': 'Saudi Arabia',
  'jeddah': 'Saudi Arabia',
  'doha': 'Qatar',
  'kuwait city': 'Kuwait',
  'tehran': 'Iran',
  'baghdad': 'Iraq',
  'amman': 'Jordan',
  'beirut': 'Lebanon',
  'tel aviv': 'Israel',
  'jerusalem': 'Israel',
  'sao paulo': 'Brazil',
  'rio de janeiro': 'Brazil',
  'buenos aires': 'Argentina',
  'mexico city': 'Mexico',
  'lima': 'Peru',
  'bogota': 'Colombia',
  'santiago': 'Chile',
};

/**
 * Detects country from location string (city name)
 * @param location - City or location name
 * @returns Country name or null if not found
 */
export const detectCountryFromLocation = (location: string): string | null => {
  if (!location) return null;
  
  // Normalize the location string
  const normalized = location.toLowerCase().trim();
  
  // Check US states first (before cities, as states are more specific)
  if (usStatesToCountry[normalized]) {
    return usStatesToCountry[normalized];
  }
  
  // Check if location contains a US state
  for (const [state, country] of Object.entries(usStatesToCountry)) {
    if (normalized.includes(state) || state.includes(normalized)) {
      return country;
    }
  }
  
  // Direct match for cities
  if (cityToCountryMap[normalized]) {
    return cityToCountryMap[normalized];
  }
  
  // Check if location contains a known city
  for (const [city, country] of Object.entries(cityToCountryMap)) {
    if (normalized.includes(city) || city.includes(normalized)) {
      return country;
    }
  }
  
  // Check if it's already a country name
  const countryNames = ['Pakistan', 'India', 'USA', 'UK', 'United Kingdom', 'United States', 
    'Canada', 'Australia', 'Singapore', 'UAE', 'United Arab Emirates', 'Japan', 'China', 
    'South Korea', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'New Zealand',
    'France', 'Germany', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Austria', 'Switzerland',
    'Sweden', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Portugal', 'Greece', 'Poland',
    'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Russia', 'Turkey', 'Egypt',
    'South Africa', 'Nigeria', 'Kenya', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Iran', 'Iraq',
    'Jordan', 'Lebanon', 'Israel', 'Brazil', 'Argentina', 'Mexico', 'Peru', 'Colombia', 'Chile'];
  
  const normalizedCountry = normalized.split(',').map(s => s.trim());
  for (const part of normalizedCountry) {
    if (countryNames.some(country => country.toLowerCase() === part)) {
      return countryNames.find(c => c.toLowerCase() === part) || null;
    }
  }
  
  return null;
};

/**
 * Gets country code for flag display
 * @param location - City or location name
 * @returns ISO country code (e.g., 'pk', 'in', 'us')
 */
export const getCountryCodeFromLocation = (location: string): string => {
  const country = detectCountryFromLocation(location);
  
  if (!country) return 'un'; // Unknown
  
  const countryCodeMap: { [key: string]: string } = {
    'Pakistan': 'pk',
    'India': 'in',
    'USA': 'us',
    'United States': 'us',
    'UK': 'gb',
    'United Kingdom': 'gb',
    'Singapore': 'sg',
    'Canada': 'ca',
    'Australia': 'au',
    'UAE': 'ae',
    'United Arab Emirates': 'ae',
    'Japan': 'jp',
    'China': 'cn',
    'South Korea': 'kr',
    'Thailand': 'th',
    'Malaysia': 'my',
    'Indonesia': 'id',
    'Philippines': 'ph',
    'Vietnam': 'vn',
    'New Zealand': 'nz',
    'France': 'fr',
    'Germany': 'de',
    'Spain': 'es',
    'Italy': 'it',
    'Netherlands': 'nl',
    'Belgium': 'be',
    'Austria': 'at',
    'Switzerland': 'ch',
    'Sweden': 'se',
    'Norway': 'no',
    'Denmark': 'dk',
    'Finland': 'fi',
    'Ireland': 'ie',
    'Portugal': 'pt',
    'Greece': 'gr',
    'Poland': 'pl',
    'Czech Republic': 'cz',
    'Hungary': 'hu',
    'Romania': 'ro',
    'Bulgaria': 'bg',
    'Russia': 'ru',
    'Turkey': 'tr',
    'Egypt': 'eg',
    'South Africa': 'za',
    'Nigeria': 'ng',
    'Kenya': 'ke',
    'Saudi Arabia': 'sa',
    'Qatar': 'qa',
    'Kuwait': 'kw',
    'Iran': 'ir',
    'Iraq': 'iq',
    'Jordan': 'jo',
    'Lebanon': 'lb',
    'Israel': 'il',
    'Brazil': 'br',
    'Argentina': 'ar',
    'Mexico': 'mx',
    'Peru': 'pe',
    'Colombia': 'co',
    'Chile': 'cl',
    'Hong Kong': 'hk',
  };
  
  return countryCodeMap[country] || 'un';
};

