/**
 * Accepts HTML `type="date"` values (`YYYY-MM-DD`) and `type="month"` values (`YYYY-MM`).
 */
export function isValidListingDateAnswer(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s) return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return !Number.isNaN(d.getTime());
  }

  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return false;
    const d = new Date(y, m - 1, 1);
    return d.getFullYear() === y && d.getMonth() === m - 1;
  }

  return false;
}

/**
 * Calculate business age in years from a given date
 * @param dateString - ISO date string or Date object
 * @returns Number of years (rounded down to nearest integer)
 */
export const calculateBusinessAge = (dateString: string | Date | null | undefined): number => {
  if (!dateString) {
    console.log('📅 calculateBusinessAge: No date provided');
    return 0;
  }
  
  try {
    let startDate: Date;
    
    // Handle different date formats
    if (dateString instanceof Date) {
      startDate = dateString;
    } else if (typeof dateString === 'string') {
      startDate = new Date(dateString);
    } else {
      console.warn('📅 calculateBusinessAge: Unknown date type', typeof dateString, dateString);
      return 0;
    }
    
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(startDate.getTime())) {
      console.warn('📅 calculateBusinessAge: Invalid date', dateString);
      return 0;
    }
    
    // Check if date is in the future (shouldn't happen, but handle it)
    if (startDate > now) {
      console.warn('📅 calculateBusinessAge: Date is in the future', dateString);
      return 0;
    }
    
    // Calculate difference in milliseconds
    const diffMs = now.getTime() - startDate.getTime();
    
    // Convert to years (365.25 days per year to account for leap years)
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    
    // Round down to nearest integer (floor)
    const age = Math.floor(diffYears);
    
    console.log('📅 calculateBusinessAge result:', {
      input: dateString,
      parsedDate: startDate.toISOString(),
      diffMs,
      diffYears,
      age,
    });
    
    return age;
  } catch (error) {
    console.error('📅 Error calculating business age:', error, dateString);
    return 0;
  }
};

/**
 * Calculate business age from listing creation date or user account creation date
 * @param listingCreatedAt - Listing creation date
 * @param userCreatedAt - User account creation date (fallback)
 * @returns Number of years
 */
export const calculateBusinessAgeFromListing = (
  listingCreatedAt?: string | Date | null,
  userCreatedAt?: string | Date | null
): number => {
  // Prefer listing creation date, fallback to user account creation date
  const dateToUse = listingCreatedAt || userCreatedAt;
  
  if (!dateToUse) {
    console.log('📅 No date available for business age calculation');
    return 0;
  }
  
  const age = calculateBusinessAge(dateToUse);
  console.log('📅 Business age calculation:', {
    dateUsed: dateToUse,
    calculatedAge: age,
    hasListingDate: !!listingCreatedAt,
    hasUserDate: !!userCreatedAt,
  });
  
  return age;
};

/**
 * Format business age in human-readable format (1 day, 2 days, 1 week, 1 month, 1 year, etc.)
 * @param dateString - ISO date string or Date object (user account creation date)
 * @returns Formatted string like "1 day", "2 days", "1 week", "1 month", "1 year", etc.
 */
export const formatBusinessAge = (dateString: string | Date | null | undefined): string => {
  if (!dateString) {
    return 'N/A';
  }
  
  try {
    let startDate: Date;
    
    // Handle different date formats
    if (dateString instanceof Date) {
      startDate = dateString;
    } else if (typeof dateString === 'string') {
      startDate = new Date(dateString);
    } else {
      return 'N/A';
    }
    
    const now = new Date();
    
    // Check if date is valid
    if (isNaN(startDate.getTime())) {
      return 'N/A';
    }
    
    // Check if date is in the future (shouldn't happen, but handle it)
    if (startDate > now) {
      return 'N/A';
    }
    
    // Calculate difference in milliseconds
    const diffMs = now.getTime() - startDate.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    // Return formatted string based on the largest unit
    if (diffYears > 0) {
      return diffYears === 1 ? '1 year' : `${diffYears} years`;
    } else if (diffMonths > 0) {
      return diffMonths === 1 ? '1 month' : `${diffMonths} months`;
    } else if (diffWeeks > 0) {
      return diffWeeks === 1 ? '1 week' : `${diffWeeks} weeks`;
    } else if (diffDays > 0) {
      return diffDays === 1 ? '1 day' : `${diffDays} days`;
    } else if (diffHours > 0) {
      return diffHours === 1 ? '1 hour' : `${diffHours} hours`;
    } else if (diffMinutes > 0) {
      return diffMinutes === 1 ? '1 minute' : `${diffMinutes} minutes`;
    } else {
      return 'Just now';
    }
  } catch (error) {
    console.error('📅 Error formatting business age:', error, dateString);
    return 'N/A';
  }
};

