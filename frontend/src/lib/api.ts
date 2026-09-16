// API Configuration — must be the NestJS origin (scheme + host + port), not the static SPA URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/** Where the API lives, for callers that fetch it outside this client. */
export { apiBaseUrl } from './apiBase';
import { uploadErrorMessage, uploadSizeRefusal } from './uploadError';
// Bearer token for API authorization - used when user is not logged in
const API_BEARER_TOKEN = import.meta.env.VITE_API_BEARER_TOKEN || '';

function apiBaseOriginMatchesPage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(API_BASE_URL).origin === window.location.origin;
  } catch {
    return false;
  }
}

function looksLikeHtmlDocument(text: string): boolean {
  const s = text.trimStart().toLowerCase();
  return s.startsWith('<!doctype') || s.startsWith('<html');
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private bearerToken: string;

  constructor(baseUrl: string, bearerToken: string = '') {
    this.baseUrl = baseUrl;
    this.bearerToken = bearerToken;
    this.loadToken();
  }

  private loadToken() {
    this.token = localStorage.getItem('auth_token');
    // Also ensure bearer token is set if we have a user token
    if (this.token) {
      this.setBearerToken(this.token);
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  setBearerToken(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Always use direct backend connection - no proxy
    // Always reload token from localStorage to ensure we have the latest
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken && storedToken !== this.token) {
      this.token = storedToken;
      this.setBearerToken(storedToken);
    }
    
    // Use user's auth token if available, otherwise use static bearer token
    const userAuthToken = this.token || storedToken;
    const finalBearerToken = userAuthToken || this.bearerToken || API_BEARER_TOKEN;
    const isAuthEndpoint =
      endpoint.startsWith('/auth/signin') ||
      endpoint.startsWith('/auth/signup') ||
      endpoint.startsWith('/auth/verify-otp') ||
      endpoint.startsWith('/auth/reset-password') ||
      endpoint.startsWith('/auth/check-reset-code') ||
      endpoint.startsWith('/auth/update-password');
    const isPublicEndpoint =
      endpoint.startsWith('/listing') ||
      endpoint.startsWith('/category') ||
      endpoint.startsWith('/health') ||
      endpoint.startsWith('/plan') ||
      endpoint.startsWith('/question-admin') ||
      // The ⓘ wording for an ad's worked-out figures: every visitor reading an
      // ad needs it, signed in or not.
      endpoint.startsWith('/ad-field-hint') ||
      endpoint.startsWith('/service-tool') ||
      endpoint.startsWith('/admin-social-account') ||
      endpoint.startsWith('/financial-admin/template') ||
      endpoint.startsWith('/subscription/plans') ||
      endpoint.startsWith('/subscription/rules-preview');
    
    if (!finalBearerToken && !isAuthEndpoint && !isPublicEndpoint) {
      console.error('CRITICAL: No bearer token available!');
      return {
        success: false,
        error: 'Authentication error: Bearer token is missing',
      };
    }
    
    // Extract query params from endpoint
    const [path, queryString] = endpoint.split('?');
    const queryParams = queryString ? `?${queryString}` : '';
    const url = `${API_BASE_URL}${path}${queryParams}`;
    
    const isFormData = options.body instanceof FormData;
    const headers: HeadersInit = {
      ...options.headers,
    };
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (finalBearerToken) {
      headers['Authorization'] = `Bearer ${finalBearerToken}`;
    }
    
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
      });

      let data;
      try {
        const text = await response.text();
        if (looksLikeHtmlDocument(text)) {
          const sameOrigin = apiBaseOriginMatchesPage();
          const hint = sameOrigin
            ? ' VITE_API_BASE_URL is the same as this site\'s address, so /user, /listing, etc. hit the SPA and return index.html. Set VITE_API_BASE_URL (and rebuild) to your NestJS URL, e.g. http://YOUR_IP:9000.'
            : ' The URL returned a web page instead of JSON. Confirm VITE_API_BASE_URL points to the running Nest API and that reverse-proxy paths forward /user, /listing, /category, /notification to Node.';
          console.error(
            'API returned HTML instead of JSON',
            { path, apiBase: API_BASE_URL, sameOriginAsPage: sameOrigin },
            text?.slice?.(0, 300),
          );
          return {
            success: false,
            error: `API misconfigured: server sent a web page, not JSON.${hint}`,
          };
        }
        try {
          data = JSON.parse(text);
        } catch {
          console.error(
            'Invalid JSON from server',
            path,
            text?.slice?.(0, 200) ?? text,
          );
          return {
            success: false,
            error: 'Invalid JSON response from server',
          };
        }
      } catch (readError) {
        console.error('Failed to read API response body:', readError);
        return {
          success: false,
          error:
            readError instanceof Error
              ? `Response incomplete or connection reset: ${readError.message}`
              : 'Response incomplete or connection reset',
        };
      }

      if (!response.ok) {
        /**
         * A blocked account, told to leave.
         *
         * Blocking clears the refresh token and every guarded route starts
         * answering 403, so the account is already shut out of the API. But the
         * access token it holds stays valid until it expires, and nothing here
         * read a 403 — so the session simply carried on: the team-member area
         * still drew itself and only its contents failed, and an ordinary user
         * noticed nothing at all.
         *
         * Only this one message ends the session. A 403 on its own means "not
         * allowed to do that", which is an ordinary answer and no reason to
         * throw someone out.
         */
        if (response.status === 403) {
          const blockedMessage = (() => {
            const payload: any = data;
            const raw =
              typeof payload?.message === 'string'
                ? payload.message
                : typeof payload?.message?.message === 'string'
                  ? payload.message.message
                  : typeof payload?.error === 'string'
                    ? payload.error
                    : '';
            return /account has been blocked/i.test(raw) ? raw : null;
          })();

          if (blockedMessage) {
            this.clearToken();
            localStorage.removeItem('user_data');
            localStorage.removeItem('bearer_token');
            window.dispatchEvent(
              new CustomEvent('auth:logout', {
                detail: { reason: 'blocked', message: blockedMessage },
              }),
            );
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              setTimeout(() => {
                window.location.href = `/login?blocked=1`;
              }, 800);
            }
            return { success: false, error: blockedMessage };
          }
        }

        // Handle 401 Unauthorized specifically
        if (response.status === 401) {
          // Don't auto-logout for auth endpoints (login/signup) - 401 is expected for invalid credentials
          const isAuthEndpoint = path.startsWith('/auth/signin') || path.startsWith('/auth/signup') || path.startsWith('/auth/verify-otp') || path.startsWith('/auth/check-reset-code');
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const isPublicPage =
            currentPath === '/' ||
            currentPath.startsWith('/all-listings') ||
            currentPath.startsWith('/listing/') ||
            currentPath.startsWith('/how-to-buy') ||
            currentPath.startsWith('/how-to-sell') ||
            currentPath.startsWith('/dashboard');
          
          // Don't auto-logout if we just logged in (within last 30 seconds)
          // This gives more time for the backend to sync/validate the token
          const lastLoginTime = localStorage.getItem('last_login_time');
          const justLoggedIn = lastLoginTime && (Date.now() - parseInt(lastLoginTime)) < 30000;
          
          if (!isAuthEndpoint && !justLoggedIn) {
            // Clear token and user data on 401 (only for non-auth endpoints and not immediately after login)
            this.clearToken();
            localStorage.removeItem('user_data');
            localStorage.removeItem('bearer_token');
            
            // Dispatch event to notify auth hook
            window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'unauthorized' } }));
            
            // Redirect to login if not already there and not on a public page
            if (!isPublicPage && window.location.pathname !== '/login') {
              setTimeout(() => {
                window.location.href = '/login';
              }, 1000);
            } else {
              // On public pages, show a dismissible login prompt instead
              window.dispatchEvent(new CustomEvent('auth:prompt', { detail: { reason: 'unauthorized' } }));
            }
          }
        }
        
        // Extract error message from various response formats
        let errorMessage = `API Error: ${response.status}`;

        const formatFieldLabel = (label: string) => {
          if (!label) return '';
          const withSpaces = label.replace(/_/g, ' ').trim();
          return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
        };

        /*
         * Zod nests as deep as the data does, so this has to walk.
         *
         * It used to look one level down and no further. A listing's answers
         * sit at `brand.0.answer`, three levels in, so nothing was found, the
         * whole error object was stringified instead, and a seller was shown
         * `{"_errors":[],"brand":{"0":{...}}}` as the reason they could not
         * publish. Array indices are dropped from the label — "Brand: Enter a
         * valid domain" reads better than "Brand 0 answer".
         */
        const extractZodErrors = (payload: any): string | null => {
          if (!payload || typeof payload !== 'object') return null;
          const messages: string[] = [];

          const walk = (node: any, trail: string[]) => {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node._errors) && node._errors.length > 0) {
              const label = trail
                .filter((part) => !/^\d+$/.test(part))
                .map(formatFieldLabel)
                .join(' ');
              messages.push(label ? `${label}: ${node._errors.join(', ')}` : node._errors.join(', '));
            }
            Object.entries(node).forEach(([key, value]) => {
              if (key === '_errors') return;
              walk(value, [...trail, key]);
            });
          };

          walk(payload, []);
          // The same wording can arrive from several rows of one list.
          return messages.length > 0 ? [...new Set(messages)].join(' | ') : null;
        };

        if (data) {
          if (typeof data === 'string') {
            errorMessage = data;
          } else {
            const zodMessage = extractZodErrors(data);
            if (zodMessage) {
              errorMessage = zodMessage;
            } else if ((data as any).error) {
              errorMessage = typeof (data as any).error === 'string' 
                ? (data as any).error 
                : ((data as any).error.message || JSON.stringify((data as any).error));
            } else if ((data as any).message) {
              errorMessage = typeof (data as any).message === 'string' 
                ? (data as any).message 
                : ((data as any).message.message || JSON.stringify((data as any).message));
            }
          }
        }

        const defaultStatusMessage = `API Error: ${response.status}`;
        const isAuthFlowEndpoint =
          path.startsWith('/auth/signin') ||
          path.startsWith('/auth/signup') ||
          path.startsWith('/auth/verify-otp') ||
          path.startsWith('/auth/get-otp') ||
          path.startsWith('/auth/reset-password') ||
          path.startsWith('/auth/check-reset-code') ||
          path.startsWith('/auth/update-password');

        // Add specific messages only when the server did not return something useful
        if (response.status === 401 && !isAuthFlowEndpoint) {
          errorMessage =
            'Unauthorized: Your session may have expired. Please log in again.';
        } else if (response.status === 404) {
          const stillGeneric =
            errorMessage === defaultStatusMessage ||
            errorMessage.startsWith('API Error:');
          if (stillGeneric) {
            errorMessage = `Route not found: ${path}. The backend endpoint may not be available. Please ensure the backend server is running and the route is registered.`;
          }
        } else if (response.status === 405) {
          errorMessage = `Method not allowed: ${options.method || 'GET'} is not allowed for ${path}.`;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Handle different response formats
      // Backend might return: { data: [...] } or directly [...]
      let responseData = data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          // Direct array response: [...]
          responseData = data;
        } else if (data.data !== undefined) {
          // Wrapped in { data: [...] } - data can be null
          responseData = data.data;
        } else if (data.status === 'success') {
          // Wrapped in { status: 'success', data: [...] } - data can be null
          responseData = data.data;
        } else {
          // Return the object as-is
          responseData = data;
        }
      }

      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      console.error('API request failed:', error);
      
      // Detect if backend server is not running
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      let userFriendlyError = errorMessage;
      
      // Check for common connection errors
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') ||
          errorMessage.includes('ERR_CONNECTION_REFUSED') ||
          errorMessage.includes('ECONNREFUSED')) {
        userFriendlyError = `Backend server is not running. Please start the backend server on ${API_BASE_URL}. Run: cd ex-buy-sell-apis && npm run start:dev`;
      }
      
      return {
        success: false,
        error: userFriendlyError,
      };
    }
  }

  // Auth endpoints
  async signUp(userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirm_password: string;
    user_type?: string;
    business_name?: string;
  }) {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    // Store token if signup successful
    if (response.success && response.data) {
      const data = response.data as any;
      if (data.tokens?.accessToken) {
        const accessToken = data.tokens.accessToken;
        this.setToken(accessToken);
        // Also update bearer token to use the user's access token
        this.setBearerToken(accessToken);
        // Store timestamp to prevent immediate logout on 401
        localStorage.setItem('last_login_time', Date.now().toString());
        
        // Also store user data
        if (data.user) {
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
      }
    }
    
    return response;
  }

  /**
   * Change your own password while signed in.
   *
   * No email address in the body: the server reads who you are from the token.
   * The emailed-code flow is for people who cannot sign in at all — and it
   * cannot finish until a verified sender is configured.
   */
  async changePassword(body: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) {
    return this.request('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async signIn(credentials: { email: string; password: string }) {
    const response = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    // Store token if login successful
    if (response.success && response.data) {
      const data = response.data as any;
      if (data.tokens?.accessToken) {
        const accessToken = data.tokens.accessToken;
        this.setToken(accessToken);
        // Also update bearer token to use the user's access token
        this.setBearerToken(accessToken);
        
        // Store timestamp to prevent immediate logout on 401
        localStorage.setItem('last_login_time', Date.now().toString());
        
        // Also store user data
        if (data.user) {
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
      } else {
        console.error('❌ Login failed: No access token in response', response.error || 'Unknown error');
      }
    } else {
      console.error('❌ Login failed:', response.error || 'Unknown error');
    }
    
    return response;
  }

  // Listing endpoints
  async createListing(listingData: any) {
    return this.request('/listing', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  }

  async getListings(params?: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    nocache?: string;
    userId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/listing${query ? `?${query}` : ''}`);
  }

  async getListingById(id: string, nocache?: boolean) {
    const url = nocache ? `/listing/${id}?nocache=true` : `/listing/${id}`;
    return this.request(url);
  }

  async getSecureListings(params?: {
    page?: number;
    limit?: number;
    category?: string;
    status?: string;
    userId?: string;
    nocache?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/listing/secure/all${query ? `?${query}` : ''}`);
  }

  async getSecureListingById(id: string) {
    return this.request(`/listing/secure/${id}`);
  }

  /**
   * Buyer accepts the confidentiality agreement. Returns `granted: true` when
   * the seller allows automatic access, or `pendingApproval: true` when the
   * seller approves buyers manually.
   */
  async acceptConfidentialityAgreement(listingId: string) {
    return this.request(`/listing/${listingId}/confidential/accept-agreement`, {
      method: 'POST',
    });
  }

  /** The signed-in user's own proof-of-funds verification status. */
  async getMyAcquisitionCapacity() {
    return this.request('/acquisition-capacity/me', { method: 'GET' });
  }

  /** Upload proof of funds for review. */
  /** SMS, email, identity and funds status in one call. */
  async getVerificationOverview() {
    return this.request('/user/me/verification', { method: 'GET' });
  }

  /** Where the identity check stands. */
  async getIdentityStatus() {
    return this.request('/identity/me', { method: 'GET' });
  }

  /** Begin an identity check; returns the provider URL to send the user to. */
  async startIdentityVerification() {
    return this.request('/identity/me/session', { method: 'POST' });
  }

  /** Email a code to a new address. The switch only happens on verify. */
  async sendEmailChangeCode(email: string) {
    return this.request('/user/me/email/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** Confirm the code and switch the sign-in address. */
  async verifyEmailChangeCode(code: string) {
    return this.request('/user/me/email/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /** Text a verification code to a phone number. */
  async sendPhoneCode(phone: string) {
    return this.request('/user/me/phone/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  /** Confirm the SMS code; the number is only saved once this passes. */
  async verifyPhoneCode(code: string) {
    return this.request('/user/me/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /** Email a code to the account's own address, to confirm it. */
  async sendEmailConfirmCode() {
    return this.request('/user/me/email/confirm/send-code', { method: 'POST' });
  }

  /** Confirm the account's own address with the emailed code. */
  async confirmEmailCode(code: string) {
    return this.request('/user/me/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /** Moderator's verdict on one uploaded proof-of-funds file. */
  /**
   * A moderator's verdict on one uploaded document, with what it proves. The
   * case total is the sum of these across verified documents — it is never
   * sent, only recomputed on the server.
   */
  async reviewAcquisitionDocument(
    documentId: string,
    status: 'IN_REVIEW' | 'VERIFIED' | 'DECLINED',
    note?: string | null,
    verifiedCapital?: number | null,
  ) {
    return this.request(`/acquisition-capacity/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note, verifiedCapital }),
    });
  }

  /** Hand a case to a moderator; null clears it. Assigning starts the review. */
  async assignAcquisitionReviewer(id: string, reviewerId: string | null) {
    return this.request(`/acquisition-capacity/${id}/responsible`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewerId }),
    });
  }

  /** Files as `{ url, name }`, so the review table can name them. */
  async submitAcquisitionDocuments(
    documents: Array<string | { url: string; name?: string }>,
  ) {
    return this.request('/acquisition-capacity/me/documents', {
      method: 'POST',
      body: JSON.stringify({ documents }),
    });
  }

  /** A buyer's verified capital — only returned to a seller in touch with them. */
  async getBuyerAcquisitionCapacity(buyerId: string) {
    return this.request(`/acquisition-capacity/buyer/${buyerId}`, { method: 'GET' });
  }

  /** Admin dashboard counts, revenue and daily series — all counted server-side. */
  async getDashboardStats() {
    return this.request('/dashboard/stats', { method: 'GET' });
  }

  /** Listings still in their early-access window, with days until they go public. */
  async getOffMarketListings() {
    return this.request('/listing/off-market', { method: 'GET' });
  }

  /** Moderator queue of proof-of-funds cases, with the verified total. */
  async getAcquisitionCapacityCases(params?: Record<string, string>) {
    const query = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/acquisition-capacity${query ? `?${query}` : ''}`, { method: 'GET' });
  }

  /**
   * Moderator records the case status and notes. The verified total is not
   * accepted here: it is the sum of the verified documents.
   */
  async reviewAcquisitionCapacity(
    id: string,
    payload: {
      status?: 'UNASSIGNED' | 'IN_REVIEW' | 'COMPLETED';
      notes?: string | null;
    },
  ) {
    return this.request(`/acquisition-capacity/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /** Report a listing to the moderation team. */
  /** Report a conversation. Lands in the same monitoring queue as the rest. */
  async reportChat(payload: { chatId: string; reason: string; notes?: string }) {
    return this.request('/monitoring-alerts/report-chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async reportListing(payload: { listingId: string; reason: string; notes?: string }) {
    return this.request('/monitoring-alerts/report-listing', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Drop a queued downgrade and stay on the current package.
   *
   * A scheduled change is otherwise locked in until its date, so one mis-click
   * costs the seller the rest of their billing period.
   */
  async cancelScheduledPackageChange(listingId: string) {
    return this.request(`/listing/${listingId}/package/cancel-change`, {
      method: 'POST',
    });
  }

  /** Start Stripe checkout for a listing's package + add-on. */
  async createListingPackageCheckout(
    listingId: string,
    payload: {
      packageId: 'MINIMUM' | 'STARTER' | 'PREMIUM';
      addon?: 'NONE' | 'CATEGORY_PAGE' | 'START_PAGE' | 'BUNDLE';
      billingCycle?: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH';
      /** The add-on's own cycle, chosen separately from the package's. */
      addonBillingCycle?: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH';
    },
  ) {
    return this.request(`/listing/${listingId}/package-checkout`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateListing(id: string, listingData: any) {
    return this.request(`/listing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(listingData),
    });
  }

  /** Begin the assisted deal process for a conversation. */
  async startDealProcess(chatId: string) {
    return this.request(`/chat/start-deal/${chatId}`, { method: 'POST' });
  }

  /** A listing's package and add-on, priced for that listing's own tier. */
  async getListingPackage(listingId: string) {
    return this.request(`/listing/${listingId}/package`, { method: 'GET' });
  }

  /*
   * Placements, addressed one at a time.
   *
   * A listing can hold more than one, each on its own subscription with its own
   * renewal date, so there is no single "the add-on" to change any more.
   */

  /** Buy a placement, or move one already held onto a different cycle. */
  async subscribeListingAddon(
    listingId: string,
    addon: 'CATEGORY_PAGE' | 'START_PAGE' | 'BUNDLE',
    billingCycle: 'MONTHLY' | 'THREE_MONTH' | 'SIX_MONTH' = 'MONTHLY',
  ) {
    return this.request(`/listing/${listingId}/addons/${addon}`, {
      method: 'POST',
      body: JSON.stringify({ billingCycle }),
    });
  }

  /** Stop one renewing; it stays up until the paid period ends. */
  async cancelListingAddon(listingId: string, addon: string) {
    return this.request(`/listing/${listingId}/addons/${addon}/cancel`, { method: 'POST' });
  }

  /** Undo that, before the date arrives. Nothing is charged. */
  async reactivateListingAddon(listingId: string, addon: string) {
    return this.request(`/listing/${listingId}/addons/${addon}/reactivate`, {
      method: 'POST',
    });
  }

  /** Stop the package renewing. Everything stays until the paid period ends. */
  async cancelListingPackage(listingId: string) {
    return this.request(`/listing/${listingId}/package/cancel`, { method: 'POST' });
  }

  async reactivateListingPackage(listingId: string) {
    return this.request(`/listing/${listingId}/package/reactivate`, { method: 'POST' });
  }

  /** Past payments, for the Billing tab's invoice list. */
  async getPaymentHistory() {
    return this.request('/subscription/payment-history', { method: 'GET' });
  }

  /** Stripe's own billing portal — where cards are actually managed. */
  async getBillingPortalUrl(returnUrl: string) {
    return this.request(
      `/subscription/portal?returnUrl=${encodeURIComponent(returnUrl)}`,
      { method: 'GET' },
    );
  }

  /** Close the signed-in member's own account. */
  async closeOwnAccount() {
    return this.request('/user/me', { method: 'DELETE' });
  }

  /** The signed-in member's subscription: plan, status, period end, pending change. */
  async getCurrentSubscription() {
    return this.request('/subscription/current', { method: 'GET' });
  }

  /** Every active plan, ordered by tier. */
  async getSubscriptionPlans() {
    return this.request('/subscription/plans', { method: 'GET' });
  }

  async getSubscriptionRules() {
    return this.request('/subscription/rules', {
      method: 'GET',
    });
  }

  /** Start a Stripe checkout for an upgrade. Returns the hosted-page URL. */
  async createSubscriptionCheckout(planSlug: string, billingCycle: string) {
    return this.request('/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({ planSlug, billingCycle }),
    });
  }

  /**
   * Record a finished Stripe checkout when the member lands back on the site,
   * rather than waiting on the webhook. Says whether it was a buyer plan or a
   * listing's package, so the success page knows where to send them.
   */
  async syncCheckoutSession(sessionId: string) {
    return this.request('/subscription/sync-session', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  /** Saved cards, and which one renewals are charged to. */
  async getPaymentMethods() {
    return this.request('/billing/payment-methods', { method: 'GET' });
  }

  /** Stripe's own page for adding a card. Returns its URL. */
  async startAddPaymentMethod() {
    return this.request('/billing/payment-methods/setup', { method: 'POST' });
  }

  /** Back from Stripe: confirm the card was saved; a first card becomes the default. */
  async confirmAddPaymentMethod(sessionId: string) {
    return this.request('/billing/payment-methods/confirm', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  async setDefaultPaymentMethod(paymentMethodId: string) {
    return this.request(
      `/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`,
      { method: 'POST' },
    );
  }

  async removePaymentMethod(paymentMethodId: string) {
    return this.request(`/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
      method: 'DELETE',
    });
  }

  /** Every invoice the signed-in member has had, from Stripe. */
  async getInvoices() {
    return this.request('/billing/invoices', { method: 'GET' });
  }

  /** A member's invoices, for the Billing tab on their account page (staff). */
  async getInvoicesForUser(userId: string) {
    return this.request(`/billing/invoices/${userId}`, { method: 'GET' });
  }

  /** The saved invoice address, and the profile to start from when there is none. */
  async getInvoiceAddress() {
    return this.request('/billing/address', { method: 'GET' });
  }

  async saveInvoiceAddress(address: Record<string, string>) {
    return this.request('/billing/address', {
      method: 'PUT',
      body: JSON.stringify(address),
    });
  }

  /**
   * Queue a move to a cheaper plan (or to Minimum, which is a cancellation)
   * for the end of the paid period. Nothing is charged or removed today.
   */
  async scheduleSubscriptionChange(planSlug: string, billingCycle: string) {
    return this.request('/subscription/schedule-change', {
      method: 'POST',
      body: JSON.stringify({ planSlug, billingCycle }),
    });
  }

  /** Drop a queued change; the current plan simply continues. */
  async cancelScheduledSubscriptionChange() {
    return this.request('/subscription/cancel-change', {
      method: 'POST',
    });
  }

  /** Free-plan rules for the create-listing wizard when the user is not signed in */
  async getSubscriptionRulesPreview() {
    return this.request('/subscription/rules-preview', {
      method: 'GET',
    });
  }

  /** Buyers waiting on the signed-in seller to approve confidential access. */
  async getConfidentialRequests() {
    return this.request('/listing/confidential-requests', { method: 'GET' });
  }

  /** Turn a buyer's request down. */
  async declineConfidentialAccess(listingId: string, buyerId: string) {
    return this.request(`/listing/${listingId}/confidential/decline`, {
      method: 'POST',
      body: JSON.stringify({ buyerId }),
    });
  }

  /** Approve a buyer's request from the requests list. */
  async approveConfidentialAccess(listingId: string, buyerId: string, chatId?: string) {
    return this.request(`/listing/${listingId}/confidential/grant`, {
      method: 'POST',
      body: JSON.stringify({ buyerId, chatId }),
    });
  }

  async getMyConfidentialAccessStatus(listingId: string) {
    return this.request(`/listing/${listingId}/confidential/access/me`, {
      method: 'GET',
    });
  }

  async getBuyerConfidentialAccessStatus(listingId: string, buyerId: string) {
    return this.request(`/listing/${listingId}/confidential/access/${buyerId}`, {
      method: 'GET',
    });
  }

  async deleteListing(id: string) {
    return this.request(`/listing/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories endpoint
  /** Categories that actually have published listings, busiest first. */
  async getTrendingCategories(limit = 4) {
    return this.request(`/category/trending?limit=${limit}`, { method: 'GET' });
  }

  async getCategories() {
    return this.request('/category');
  }

  async createCategory(categoryData: { name: string; image_path?: string }) {
    return this.request('/category', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  async updateCategory(id: string, categoryData: { name?: string; image_path?: string }) {
    return this.request(`/category/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(categoryData),
    });
  }

  async deleteCategory(id: string) {
    return this.request(`/category/${id}`, {
      method: 'DELETE',
    });
  }

  // Tools endpoints
  async getTools() {
    return this.request('/service-tool');
  }

  async createTool(toolData: { 
    name: string; 
    image_path?: string;
    imageFile?: File;
  }) {
    if (toolData.imageFile) {
      const formData = new FormData();
      formData.append('image', toolData.imageFile);
      formData.append('name', toolData.name);
      if (toolData.image_path) {
        formData.append('image_path', toolData.image_path);
      }
      return this.request('/service-tool', {
        method: 'POST',
        body: formData,
      });
    }

    return this.request('/service-tool', {
      method: 'POST',
      body: JSON.stringify({
        name: toolData.name,
        image_path: toolData.image_path,
      }),
    });
  }

  async updateTool(id: string, toolData: { 
    name?: string; 
    image_path?: string;
    imageFile?: File;
  }) {
    if (toolData.imageFile) {
      const formData = new FormData();
      formData.append('image', toolData.imageFile);
      if (toolData.name) {
        formData.append('name', toolData.name);
      }
      if (toolData.image_path) {
        formData.append('image_path', toolData.image_path);
      }
      return this.request(`/service-tool/${id}`, {
        method: 'PUT',
        body: formData,
      });
    }

    return this.request(`/service-tool/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: toolData.name,
        image_path: toolData.image_path,
      }),
    });
  }

  async deleteTool(id: string) {
    return this.request(`/service-tool/${id}`, {
      method: 'DELETE',
    });
  }

  // Prohibited Words endpoints
  async getProhibitedWords() {
    return this.request('/prohibited-word/');
  }

  async getProhibitedWordById(id: string) {
    return this.request(`/prohibited-word/${id}`);
  }

  /** Category values are the stored enum: CONTACT_INFO, PAYMENT_METHODS, … */
  async createProhibitedWord(wordData: { word: string; category?: string }) {
    return this.request('/prohibited-word', {
      method: 'POST',
      body: JSON.stringify(wordData),
    });
  }

  // `is_active` is gone: there is no such column, so sending it did nothing
  // beyond making the UI claim success.
  async updateProhibitedWord(id: string, wordData: { word?: string; category?: string }) {
    return this.request(`/prohibited-word/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(wordData),
    });
  }

  async deleteProhibitedWord(id: string) {
    return this.request(`/prohibited-word/${id}`, {
      method: 'DELETE',
    });
  }

  // Integrations endpoint
  async getIntegrations() {
    return this.request('/integration');
  }

  // Admin Questions endpoints
  async getAdminQuestions() {
    return this.request('/question-admin');
  }

  async getAdminQuestionsByType(type: string, categoryId?: string) {
    const query = categoryId ? `?category=${encodeURIComponent(categoryId)}` : "";
    return this.request(`/question-admin/type/${type}${query}`);
  }

  async createAdminQuestion(questionData: {
    question: string;
    answer_type: string;
    answer_for: string;
    option?: string[];
    options?: string[];
    dependsOnQuestionId?: string | null;
    dependsOnValue?: string | null;
    required?: boolean | null;
    categoryId?: string | null;
    hint?: string | null;
    publicHint?: string | null;
  }) {
    // Backend DTO expects 'options' (plural), not 'option' (singular)
    const payload: any = {
      question: questionData.question,
      answer_type: questionData.answer_type === 'UMBER' ? 'NUMBER' : questionData.answer_type,
      answer_for: questionData.answer_for,
    };

    // Only include options if it's provided and not empty
    const normalizedOptions = questionData.options ?? questionData.option;
    if (normalizedOptions && normalizedOptions.length > 0) {
      payload.options = normalizedOptions; // Send as 'options' to match DTO
    }

    // Optional conditional-display dependency.
    if (questionData.dependsOnQuestionId) payload.dependsOnQuestionId = questionData.dependsOnQuestionId;
    if (questionData.dependsOnValue) payload.dependsOnValue = questionData.dependsOnValue;
    if (typeof questionData.required === 'boolean') payload.required = questionData.required;
    // Which category's set the question joins. Sent only when there is one, so
    // a caller that predates categories still writes a category-less question.
    if (questionData.categoryId) payload.categoryId = questionData.categoryId;
    if (questionData.hint) payload.hint = questionData.hint;
    if (questionData.publicHint) payload.publicHint = questionData.publicHint;

    return this.request('/question-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAdminQuestion(id: string, questionData: {
    question?: string;
    answer_type?: string;
    answer_for?: string;
    option?: string[];
    options?: string[];
    dependsOnQuestionId?: string | null;
    dependsOnValue?: string | null;
    required?: boolean | null;
    hint?: string | null;
    publicHint?: string | null;
  }) {
    // Backend DTO expects 'options' (plural), not 'option' (singular)
    const payload: any = {};

    if (questionData.question !== undefined) payload.question = questionData.question;
    if (questionData.answer_type !== undefined) {
      payload.answer_type = questionData.answer_type === 'UMBER' ? 'NUMBER' : questionData.answer_type;
    }
    if (questionData.answer_for !== undefined) payload.answer_for = questionData.answer_for;

    // Include options if it's provided (even if empty array to clear options)
    const normalizedOptions = questionData.options ?? questionData.option;
    if (normalizedOptions !== undefined) {
      payload.options = normalizedOptions; // Send as 'options' to match DTO
    }

    // Include dependency when provided (null clears it).
    if (questionData.dependsOnQuestionId !== undefined) payload.dependsOnQuestionId = questionData.dependsOnQuestionId || null;
    if (questionData.dependsOnValue !== undefined) payload.dependsOnValue = questionData.dependsOnValue || null;
    if (questionData.required !== undefined) payload.required = questionData.required;
    // Sent whenever the caller had an opinion, empty string included — that is
    // how an administrator clears a hint they no longer want.
    if (questionData.hint !== undefined) payload.hint = questionData.hint || null;
    if (questionData.publicHint !== undefined) {
      payload.publicHint = questionData.publicHint || null;
    }

    return this.request(`/question-admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Write a whole step's order in one request.
   *
   * A call per question would leave the arrangement half-saved whenever one of
   * them failed, and a step can hold thirty.
   */
  async reorderAdminQuestions(items: { id: string; position: number }[]) {
    return this.request('/question-admin/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  /**
   * The ⓘ wording for the ad's worked-out figures.
   *
   * Public: every visitor reading an ad needs it. The question-based hints
   * arrive with the questions themselves; these have no question to arrive
   * with.
   */
  async getAdFieldHints() {
    return this.request('/ad-field-hint');
  }

  async saveAdFieldHints(hints: Record<string, string>) {
    return this.request('/ad-field-hint', {
      method: 'PUT',
      body: JSON.stringify({ hints }),
    });
  }

  // The order the listing form asks its areas in, arranged in Content Management.
  async getListingAreaOrder() {
    return this.request('/listing-area-order');
  }

  async saveListingAreaOrder(areas: string[]) {
    return this.request('/listing-area-order', {
      method: 'PUT',
      body: JSON.stringify({ areas }),
    });
  }

  async deleteAdminQuestion(id: string) {
    return this.request(`/question-admin/${id}`, {
      method: 'DELETE',
    });
  }

  // Plan/Package endpoints
  async getPlans() {
    return this.request('/plan');
  }

  async getPlanById(id: string) {
    return this.request(`/plan/${id}`);
  }

  async createPlan(planData: {
    title: string;
    description: string;
    duration: string;
    type: string;
    price: string;
    features?: string[];
  }) {
    // Map frontend fields to backend DTO fields
    // Backend DTO expects 'duration' but Prisma schema uses 'duration_type'
    // Backend DTO expects 'features' but Prisma schema uses 'feature'
    // The backend service should handle this mapping, but we'll send what DTO expects
    const payload: any = {
      title: planData.title,
      description: planData.description,
      duration: planData.duration, // DTO field name
      type: planData.type,
      price: planData.price,
    };

    // Only include features if provided
    if (planData.features && planData.features.length > 0) {
      payload.features = planData.features; // DTO field name
    }

    const response = await this.request('/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response;
  }

  async updatePlan(id: string, planData: {
    title?: string;
    description?: string;
    duration?: string;
    type?: string;
    price?: string;
    features?: string[];
  }) {
    return this.request(`/plan/${id}`, {
      method: 'PUT',
      body: JSON.stringify(planData),
    });
  }

  async deletePlan(id: string) {
    return this.request(`/plan/${id}`, {
      method: 'DELETE',
    });
  }

  // Financial admin template (global P&L table for listing wizard)
  async getFinancialAdminTemplate() {
    return this.request('/financial-admin/template');
  }

  async updateFinancialAdmin(
    userId: string,
    payload: {
      columns?: string[];
      rows?: {
        rowLabels: string[];
        columnLabels: Array<{
          key: string;
          label: string;
          isToday?: boolean;
          labelCustomized?: boolean;
        }>;
        financialData: Record<string, Record<string, string>>;
      };
    },
  ) {
    return this.request(`/financial-admin/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Admin Social Account endpoints (following question-admin and financial-admin pattern)
  async getSocialAccounts() {
    return this.request('/admin-social-account');
  }

  async getSocialAccountById(id: string) {
    return this.request(`/admin-social-account/${id}`);
  }

  async createSocialAccount(accountData: { social_account_option: string }) {
    const response = await this.request('/admin-social-account', {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
    return response;
  }

  async updateSocialAccount(id: string, accountData: { social_account_option: string }) {
    return this.request(`/admin-social-account/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(accountData),
    });
  }

  async deleteSocialAccount(id: string) {
    return this.request(`/admin-social-account/${id}`, {
      method: 'DELETE',
    });
  }

  // User endpoints
  async getAllUsers(nocache: boolean = false) {
    const url = nocache ? '/user?nocache=true' : '/user';
    return this.request(url);
  }

  async getUserById(id: string) {
    return this.request(`/user/${id}`);
  }

  async updateUser(id: string, userData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    /** Plain calendar date, YYYY-MM-DD. `null` clears it. */
    birthday?: string | null;
    phone?: string;
    address?: string;
    country?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    profile_pic?: string;
    background?: string;
    business_name?: string;
    availability_status?: string;
    role?: string;
    verified?: boolean;
  }) {
    return this.request(`/user/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async updateUserByAdmin(id: string, userData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    country?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    role?: string;
    active?: boolean;
    availability_status?: string;
    verified?: boolean;
    is_email_verified?: boolean;
    is_phone_verified?: boolean;
    /**
     * The new password in plain text. Despite the name, the server hashes it
     * before storing and drops the account's refresh token, so sessions opened
     * with the old password end.
     */
    password_hash?: string;
  }) {
    return this.request(`/user/update-by-admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  }

  async updateUserPreferences(userId: string, preferences: {
    background?: string | null;
    businessCategories?: string[];
    niches?: string[];
    sellerLocation?: string | null;
    targetLocation?: string | null;
    listingPriceRange?: { min?: string | null; max?: string | null } | null;
    businessAgeRange?: { min?: string | null; max?: string | null } | null;
    yearlyProfitRange?: { min?: string | null; max?: string | null } | null;
    profitMultipleRange?: { min?: string | null; max?: string | null } | null;
  }) {
    return this.request(`/user/preferences/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    });
  }

  /**
   * Account-level moderation: refuses sign-in, ends open sessions and takes the
   * listings off the marketplace. Not to be confused with blockUser() further
   * down, which is one member blocking another inside a chat.
   */
  async blockAccount(id: string, reason?: string) {
    return this.request(`/user/${id}/block`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? null }),
    });
  }

  async unblockAccount(id: string) {
    return this.request(`/user/${id}/unblock`, {
      method: 'POST',
    });
  }

  /**
   * The general conversation with a member — deliberately not attached to any
   * listing, so support messages do not land inside a thread about a business.
   * Returns the existing one, or opens it.
   */
  async getOrCreateDirectChat(otherUserId: string) {
    return this.request(`/chat/direct/${otherUserId}`);
  }

  /** Hand a conversation to a team member; pass null to clear the assignment. */
  async setChatResponsible(chatId: string, responsibleId: string | null) {
    return this.request(`/chat/responsible/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify({ responsibleId }),
    });
  }

  /** Another user's invoices, for the Billing tab. Staff only, read-only. */
  async getPaymentHistoryForUser(userId: string) {
    return this.request(`/subscription/payment-history/${userId}`);
  }

  /**
   * A member's activity log, newest first: what they did and what the team did
   * to them. `before` asks for the next, older page.
   */
  async getActivityLogByUser(
    userId: string,
    filters: { category?: string; from?: string; to?: string; before?: string; limit?: number } = {},
  ) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/activity-log/user/${userId}${suffix}`);
  }

  /** Listings, chats and activity a team member is responsible for. */
  async getTeamMemberStats(userId: string) {
    return this.request(`/user/${userId}/team-stats`);
  }

  /** Accounts sharing an email address; sign-in only ever reaches the oldest. */
  async getDuplicateAccounts() {
    return this.request('/user/duplicates');
  }

  async deleteUser(id: string) {
    return this.request(`/user/${id}`, {
      method: 'DELETE',
    });
  }

  async createUserByAdmin(userData: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    confirm_password: string;
    role: 'ADMIN' | 'USER' | 'MONITER';
    active: boolean;
  }) {
    return this.request('/user/create-by-admin', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Favorites endpoints
  async getFavorites() {
    return this.request('/user/favourite');
  }

  async getFavoritesByUserId(userId: string) {
    return this.request(`/user/favourite/user/${userId}`);
  }

  async getFavoritesCountByUserId(userId: string) {
    return this.request(`/user/favourite/user/${userId}/count`);
  }

  async addFavorite(listingId: string) {
    return this.request(`/user/favourite/add/${listingId}`, {
      method: 'GET',
    });
  }

  async removeFavorite(listingId: string) {
    return this.request(`/user/favourite/remove/${listingId}`, {
      method: 'GET',
    });
  }

  // Auth helper methods
  async getOTP(email: string) {
    return this.request(`/auth/get-otp/${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  }

  /**
   * Confirm an address with its emailed code. For a sign-up this is when the
   * account is made, and the answer signs it in — stored the way sign-in does.
   */
  async verifyOTP(data: { email: string; otp_code: string }) {
    const response = await this.request('/auth/verify-otp', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const payload = (response.success ? response.data : null) as any;
    if (payload?.tokens?.accessToken) {
      this.setToken(payload.tokens.accessToken);
      this.setBearerToken(payload.tokens.accessToken);
      localStorage.setItem('last_login_time', Date.now().toString());
      if (payload.user) localStorage.setItem('user_data', JSON.stringify(payload.user));
    }
    return response;
  }

  async resetPassword(email: string) {
    return this.request(`/auth/reset-password/${email}`, {
      method: 'POST',
    });
  }

  async updatePassword(data: { email: string; otp_code: string; new_password: string; confirm_password: string }) {
    return this.request('/auth/update-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /** Check a password-reset code without spending it; `updatePassword` does. */
  async checkResetCode(data: { email: string; otp_code: string }) {
    return this.request('/auth/check-reset-code', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async logout(userId: string) {
    return this.request(`/auth/logout/${userId}`, {
      method: 'GET',
    });
  }

  // Chat message operations
  async markMessagesAsRead(chatId: string, userId: string) {
    return this.request(`/chat/mark-read/${chatId}/${userId}`, {
      method: 'PUT',
    });
  }

  async markMessagesAsReadForMonitor(chatId: string, monitorId?: string) {
    const url = monitorId
      ? `/chat/mark-read/monitor/${chatId}?monitorId=${monitorId}`
      : `/chat/mark-read/monitor/${chatId}`;
    return this.request(url, {
      method: 'PUT',
    });
  }

  /**
   * Add a document to a listing, privately.
   *
   * Replaces uploading straight to the CDN from the browser. That path used an
   * unsigned preset, which could only ever produce a public file — every
   * contract and P&L on this platform is readable by anyone holding the link
   * because of it — and, since the preset name ships in this bundle, it let
   * anyone upload to the account at all.
   *
   * What comes back is an id and an API path, not a CDN address: the file is
   * only readable through the server now, by someone allowed to read it.
   */
  async uploadListingAttachment(listingId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const response = await fetch(
        `${this.baseUrl}/attachments/${encodeURIComponent(listingId)}`,
        { method: 'POST', headers, body: formData },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          error: uploadErrorMessage(data, `Upload failed (${response.status})`),
        };
      }
      return { success: true, data: data?.data ?? data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload a chat file or a category image and return where it lives.
   *
   * This used to post to `/upload`, a route the server has never had, so every
   * chat photo and file failed with a 404 — shown as "[object Object]". It now
   * goes to Cloudinary the way listing photos already do, and lands on a public
   * link just as they do.
   */
  async uploadFile(
    file: File,
    type: 'photo' | 'attachment',
  ): Promise<ApiResponse<{ url: string; path?: string }>> {
    const refusal = uploadSizeRefusal(file.size);
    if (refusal) return { success: false, error: refusal };

    // Loaded on first use, so its start-up log stays off pages that never upload.
    const { uploadToCloudinary } = await import('./cloudinary');
    const result = await uploadToCloudinary(
      file,
      type === 'photo' ? 'uploads/photos' : 'uploads/files',
    );
    if (!result.success || !result.url) {
      return { success: false, error: result.error || 'Upload failed' };
    }
    return { success: true, data: { url: result.url } };
  }

  // Chat endpoints
  async getChatRoomsByUserId(userId: string) {
    return this.request(`/chat/fetch/user/${userId}`, {
      method: 'GET',
    });
  }

  async getChatRoomsBySellerId(sellerId: string) {
    return this.request(`/chat/fetch/seller/${sellerId}`, {
      method: 'GET',
    });
  }

  async getChatRoom(userId: string, sellerId: string, listingId?: string) {
    // CRITICAL: Include listingId as query parameter to scope chat to specific listing
    const url = listingId 
      ? `/chat/fetch/${userId}/${sellerId}?listingId=${listingId}`
      : `/chat/fetch/${userId}/${sellerId}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  async createChatRoom(userId: string, sellerId: string, listingId?: string) {
    // CRITICAL: Include listingId as query parameter to create listing-specific chat
    const url = listingId 
      ? `/chat/create/${userId}/${sellerId}?listingId=${listingId}`
      : `/chat/create/${userId}/${sellerId}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  async getChatCount(userId: string) {
    return this.request(`/chat/get-chat-count/${userId}`, {
      method: 'GET',
    });
  }

  async getActivityLogCount(userId: string) {
    return this.request(`/activity-log/log-count/${userId}`, {
      method: 'GET',
    });
  }

  async getMonitoringAlerts() {
    return this.request('/monitoring-alerts', {
      method: 'GET',
    });
  }

  async updateMonitoringAlertStatus(alertId: string, status: string) {
    return this.request(`/monitoring-alerts/${alertId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async assignMonitoringAlert(alertId: string, responsibleId: string | null) {
    return this.request(`/monitoring-alerts/${alertId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ responsibleId }),
    });
  }

  async updateChatLabel(chatId: string, label: 'GOOD' | 'BAD' | 'MEDIUM', userId: string) {
    return this.request('/chat/update/label', {
      method: 'PUT',
      body: JSON.stringify({ chatId, label, userId }),
    });
  }

  // Removed: getAgoraToken - No longer using Agora, using WebRTC with WebSocket instead
  // This function is kept for backward compatibility but should not be used

  async deleteChat(chatId: string, userId: string) {
    return this.request(`/chat/delete/${chatId}/${userId}`, {
      method: 'DELETE',
    });
  }

  async archiveChat(chatId: string, userId: string) {
    return this.request(`/chat/archive/${chatId}/${userId}`, {
      method: 'PUT',
    });
  }

  // Notification methods
  async getNotifications() {
    return this.request('/notification', {
      method: 'GET',
    });
  }

  async getUnreadNotificationCount() {
    return this.request('/notification/unread-count', {
      method: 'GET',
    });
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/notification/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notification/mark-all-read', {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId: string) {
    return this.request(`/notification/${notificationId}`, {
      method: 'DELETE',
    });
  }

  // Message edit/delete methods
  async editMessage(messageId: string, content: string) {
    return this.request(`/chat/message/${messageId}/edit`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async deleteMessage(messageId: string) {
    return this.request(`/chat/message/${messageId}/delete`, {
      method: 'DELETE',
    });
  }

  async unarchiveChat(chatId: string, userId: string) {
    return this.request(`/chat/unarchive/${chatId}/${userId}`, {
      method: 'PUT',
    });
  }

  /**
   * Hold a conversation at the top of this person's own list.
   *
   * Pins used to live in localStorage, so they were a property of the browser
   * rather than of the person — gone on a second device, and invisible to a
   * colleague looking at the same queue.
   */
  /**
   * Find conversations by message text, listing name, or participant.
   *
   * The list could only filter what it was already holding — the two names and
   * the single most recent message — so a word said earlier in a conversation
   * was unfindable. This asks the database instead.
   */
  async searchChats(query: string) {
    return this.request(`/chat/search?q=${encodeURIComponent(query)}`);
  }

  async pinChat(chatId: string, userId: string) {
    return this.request(`/chat/pin/${chatId}/${userId}`, {
      method: 'PUT',
    });
  }

  async unpinChat(chatId: string, userId: string) {
    return this.request(`/chat/unpin/${chatId}/${userId}`, {
      method: 'PUT',
    });
  }

  async grantConfidentialAccessFromChat(chatId: string) {
    return this.request(`/chat/confidential/grant/${chatId}`, {
      method: 'POST',
    });
  }

  async revokeConfidentialAccessFromChat(chatId: string) {
    return this.request(`/chat/confidential/revoke/${chatId}`, {
      method: 'DELETE',
    });
  }

  async blockUser(blockerId: string, blockedUserId: string) {
    return this.request(`/chat/block/${blockerId}/${blockedUserId}`, {
      method: 'POST',
    });
  }

  async unblockUser(blockerId: string, blockedUserId: string) {
    return this.request(`/chat/unblock/${blockerId}/${blockedUserId}`, {
      method: 'POST',
    });
  }

  // Admin chat endpoints
  async getAllChats() {
    return this.request('/chat/all');
  }

  // Monitor/Admin chat endpoint (dedicated for monitor dashboard)
  async getAllChatsForMonitor(monitorId?: string) {
    const url = monitorId
      ? `/chat/monitor/all?monitorId=${monitorId}`
      : '/chat/monitor/all';
    return this.request(url);
  }

  async getChatById(chatId: string) {
    return this.request(`/chat/${chatId}`, {
      method: 'GET',
    });
  }

  // Chat assignment endpoints
  async assignMonitorToChat(chatId: string, monitorId: string) {
    return this.request(`/chat/assign/${chatId}/${monitorId}`, {
      method: 'POST',
    });
  }

  async unassignMonitorFromChat(chatId: string, monitorId?: string) {
    const url = monitorId 
      ? `/chat/unassign/${chatId}?monitorId=${monitorId}`
      : `/chat/unassign/${chatId}`;
    return this.request(url, {
      method: 'DELETE',
    });
  }

  async getAssignedMonitor(chatId: string) {
    return this.request(`/chat/assigned/${chatId}`, {
      method: 'GET',
    });
  }

  // Health check endpoint
  async checkHealth() {
    return this.request('/health', {
      method: 'GET',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL, API_BEARER_TOKEN);

// Initialize bearer token on app start
function initializeBearerToken() {
  // First, check if user is already logged in (has token in localStorage)
  const userToken = localStorage.getItem('auth_token');
  
  if (userToken) {
    // User is logged in - use their token
    apiClient.setToken(userToken);
    apiClient.setBearerToken(userToken);
  } else if (API_BEARER_TOKEN) {
    // No user logged in - use default bearer token
    apiClient.setBearerToken(API_BEARER_TOKEN);
  }
}

// Initialize immediately
initializeBearerToken();

// Also listen for storage changes (when user logs in/out)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_token') {
      initializeBearerToken();
    }
  });
}

export type { ApiResponse };
