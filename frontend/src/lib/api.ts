// API Configuration — must be the NestJS origin (scheme + host + port), not the static SPA URL.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
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
      endpoint.startsWith('/auth/update-password');
    const isPublicEndpoint =
      endpoint.startsWith('/listing') ||
      endpoint.startsWith('/category') ||
      endpoint.startsWith('/health') ||
      endpoint.startsWith('/plan') ||
      endpoint.startsWith('/question-admin') ||
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
        // Handle 401 Unauthorized specifically
        if (response.status === 401) {
          // Don't auto-logout for auth endpoints (login/signup) - 401 is expected for invalid credentials
          const isAuthEndpoint = path.startsWith('/auth/signin') || path.startsWith('/auth/signup') || path.startsWith('/auth/verify-otp');
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

        const extractZodErrors = (payload: any): string | null => {
          if (!payload || typeof payload !== 'object') return null;
          const messages: string[] = [];
          if (Array.isArray(payload._errors) && payload._errors.length > 0) {
            messages.push(payload._errors.join(', '));
          }
          Object.entries(payload).forEach(([key, value]) => {
            if (key === '_errors' || !value || typeof value !== 'object') return;
            const fieldErrors = (value as any)._errors;
            if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
              messages.push(`${formatFieldLabel(key)}: ${fieldErrors.join(', ')}`);
            }
          });
          return messages.length > 0 ? messages.join(' | ') : null;
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

  async updateListing(id: string, listingData: any) {
    return this.request(`/listing/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(listingData),
    });
  }

  async getSubscriptionRules() {
    return this.request('/subscription/rules', {
      method: 'GET',
    });
  }

  /** Free-plan rules for the create-listing wizard when the user is not signed in */
  async getSubscriptionRulesPreview() {
    return this.request('/subscription/rules-preview', {
      method: 'GET',
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

  async createProhibitedWord(wordData: { word: string }) {
    return this.request('/prohibited-word', {
      method: 'POST',
      body: JSON.stringify(wordData),
    });
  }

  async updateProhibitedWord(id: string, wordData: { word?: string; is_active?: boolean; category?: string }) {
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

  async getAdminQuestionsByType(type: string) {
    return this.request(`/question-admin/type/${type}`);
  }

  async createAdminQuestion(questionData: { 
    question: string; 
    answer_type: string;
    answer_for: string;
    option?: string[];
    options?: string[];
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
    
    return this.request(`/question-admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
    return this.request(`/auth/get-otp/${email}`, {
      method: 'GET',
    });
  }

  async verifyOTP(data: { email: string; otp_code: string }) {
    return this.request('/auth/verify-otp', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  // File upload
  async uploadFile(file: File, type: 'photo' | 'attachment') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const headers: HeadersInit = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Upload failed',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('File upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload error',
      };
    }
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
