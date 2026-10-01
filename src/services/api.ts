// Frontend API Service Layer for Luxury Home (منزل الفخامة)
// Provides authenticated requests, Bearer token management, and structured error handling

const AUTH_TOKEN_KEY = 'luxury_home_jwt_token';
const AUTH_USER_KEY = 'luxury_home_user_profile';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to set auth token in localStorage', e);
  }
}

export function getAuthUser(): any | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setAuthUser(user: any | null) {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (e) {
    console.error('Failed to set auth user in localStorage', e);
  }
}

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers
  });

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = (typeof data === 'object' && data?.message) || `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

// Authentication Service
export const authService = {
  async login(username: string, password: string) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) {
      setAuthToken(res.token);
      setAuthUser(res.user);
    }
    return res;
  },

  async registerAdmin(data: { username: string; password: string; name?: string; email?: string }) {
    const res = await apiFetch('/api/auth/register-admin', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      setAuthToken(res.token);
      setAuthUser(res.user);
    }
    return res;
  },

  async getCurrentUser() {
    return apiFetch('/api/auth/me');
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      setAuthToken(null);
      setAuthUser(null);
    }
  }
};

// Booking & Lease Service
export const bookingService = {
  async createDailyBooking(payload: any) {
    return apiFetch('/api/bookings/daily', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async createLeaseContract(payload: any) {
    return apiFetch('/api/leases/contract', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async checkAndReserve(payload: any) {
    return apiFetch('/api/bookings/check-and-reserve', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

// State Synchronization Service
export const stateService = {
  async fetchServerState() {
    return apiFetch('/api/state');
  },

  async pushServerState(state: any) {
    return apiFetch('/api/state/sync', {
      method: 'POST',
      body: JSON.stringify(state)
    });
  }
};

// Financials Service
export const financialsService = {
  async calculateDistribution(payload: any) {
    return apiFetch('/api/financials/calculate-distribution', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async computeAllocation(payload: any) {
    return apiFetch('/api/financials/allocate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
