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

  async registerAdmin(data: { username: string; password: string; name?: string; email?: string; setupSecret?: string }) {
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

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (res.token) {
      setAuthToken(res.token);
      setAuthUser(res.user);
    }
    return res;
  },

  async changeProfile(data: { currentPassword: string; username?: string; name?: string; email?: string; phone?: string }) {
    const res = await apiFetch('/api/auth/change-profile', {
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

// Users & Permissions Management Service (SUPER_ADMIN)
export const userService = {
  async getUsers() {
    return apiFetch('/api/users');
  },
  async createUser(data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    phone?: string;
    role: string;
    allowedProperties?: string[];
    mustChangePassword?: boolean;
  }) {
    return apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateUser(id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    allowedProperties?: string[];
    isActive?: boolean;
  }) {
    return apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async resetPassword(id: string, customTemporaryPassword?: string) {
    return apiFetch(`/api/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ customTemporaryPassword })
    });
  },
  async deleteUser(id: string) {
    return apiFetch(`/api/users/${id}`, {
      method: 'DELETE'
    });
  }
};

// Properties Service
export const propertyService = {
  async getProperties() {
    return apiFetch('/api/properties');
  },
  async createProperty(data: any) {
    return apiFetch('/api/properties', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateProperty(id: string, data: any) {
    return apiFetch(`/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteProperty(id: string) {
    return apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
  }
};

// Units Service
export const unitService = {
  async getUnits() {
    return apiFetch('/api/units');
  },
  async createUnit(data: any) {
    return apiFetch('/api/units', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateUnit(id: string, data: any) {
    return apiFetch(`/api/units/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteUnit(id: string) {
    return apiFetch(`/api/units/${id}`, { method: 'DELETE' });
  }
};

// Expenses Service
export const expenseService = {
  async getExpenses() {
    return apiFetch('/api/expenses');
  },
  async createExpense(data: any) {
    return apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateExpense(id: string, data: any) {
    return apiFetch(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async deleteExpense(id: string) {
    return apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
  }
};

// Settings Service
export const settingsService = {
  async getPublicSettings() {
    return apiFetch('/api/public/settings');
  },
  async updateSettings(data: any) {
    return apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) });
  }
};

// Media Service
export const mediaService = {
  async uploadFile(base64Data: string, fileName: string, isPrivate: boolean = false) {
    return apiFetch('/api/media/upload', {
      method: 'POST',
      body: JSON.stringify({ base64Data, fileName, isPrivate })
    });
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
  },

  async getStatement(id: string) {
    return apiFetch(`/api/financials/statement/${id}`);
  }
};

// State Service
export const stateService = {
  async fetchServerState() {
    return apiFetch('/api/state');
  }
};

// Admin Import & Backup Service
export const adminService = {
  async previewImport(payload: any) {
    return apiFetch('/api/admin/import-data', {
      method: 'POST',
      body: JSON.stringify({ mode: 'preview', payload })
    });
  },
  async commitImport(payload: any) {
    return apiFetch('/api/admin/import-data', {
      method: 'POST',
      body: JSON.stringify({ mode: 'commit', payload })
    });
  },
  async exportBackup() {
    return apiFetch('/api/backup/export', { method: 'POST' });
  },
  async restoreBackup(backupFileName: string) {
    return apiFetch('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupFileName })
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

// Parking Spots Service
export const parkingService = {
  async getParkingSpots() {
    return apiFetch('/api/parking-spots');
  },
  async createParkingSpot(data: any) {
    return apiFetch('/api/parking-spots', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  async updateParkingSpot(id: string, data: any) {
    return apiFetch(`/api/parking-spots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  async deleteParkingSpot(id: string) {
    return apiFetch(`/api/parking-spots/${id}`, {
      method: 'DELETE'
    });
  },
  async assignParkingSpot(id: string, unitId: string) {
    return apiFetch(`/api/parking-spots/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ unitId })
    });
  },
  async unassignParkingSpot(id: string) {
    return apiFetch(`/api/parking-spots/${id}/unassign`, {
      method: 'POST'
    });
  }
};

