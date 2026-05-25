// Configuration centralisée de l'API

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Helper pour les requêtes avec gestion d'erreurs
export async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erreur API ${endpoint}:`, error);
    throw error;
  }
}

// Types pour l'authentification
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

// Helper pour stocker le token
export function saveAuthToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("authToken", token);
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("authToken");
  }
  return null;
}

export function removeAuthToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
  }
}

// =====================================================
// Types partagés
// =====================================================
export interface Zone {
  id: string;
  name: string;
  sector_number?: string;
  region_id: string;
}

// Fetch des zones (utilisé dans ReportsForm et OutageForm)
export async function fetchZones(): Promise<Zone[]> {
  try {
    const res = await fetch(`${API_URL}/zones/`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Helper pour requêtes authentifiées
export async function fetchAuthAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getAuthToken();

  return fetchAPI<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
