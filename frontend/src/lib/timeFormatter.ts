/**
 * Formats a date/time for chat messages
 * Shows relative time: "1 minute ago", "1 day ago", "1 week ago", "1 month ago", etc.
 */
export const formatChatTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
};

/**
 * Formats a date/time for admin messages
 * Format: "12 Nov 2025, 09:10 AM"
 */
export const formatAdminMessageTime = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${day} ${month} ${year}, ${hours}:${minutesStr} ${ampm}`;
};


/**
 * "Last online 2 hours ago" for the chat details panel.
 *
 * Deliberately vague past a week: the exact minute someone was last around is
 * neither useful nor especially comfortable to publish, and the panel only
 * needs to say whether they are likely to reply soon.
 */
export const formatLastSeen = (lastOffline?: string | Date | null): string => {
  if (!lastOffline) return 'Offline';

  const then = new Date(lastOffline).getTime();
  if (!Number.isFinite(then)) return 'Offline';

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Last online just now';
  if (minutes < 60) return `Last online ${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last online ${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Last online ${days} day${days === 1 ? '' : 's'} ago`;

  return 'Last online over a week ago';
};
