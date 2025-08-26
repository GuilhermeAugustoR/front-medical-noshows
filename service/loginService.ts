/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/lib/api";
import type {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  RefreshTokenResponse,
  LogoutResponse,
  User,
} from "./types";

const ACCESS_TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

/**
 * Salva os dados de autenticação no localStorage
 */
const saveAuthData = (authData: AuthResponse["data"]): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_TOKEN_KEY, authData.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
  }
};

/**
 * Remove os dados de autenticação do localStorage
 */
const clearAuthData = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

/**
 * Realiza o login do usuário
 */
export const login = async (
  credentials: LoginCredentials
): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>("/auth/login", credentials);

    if (response.data.success) {
      saveAuthData(response.data.data);
    }

    return response.data;
  } catch (error: any) {
    console.error("Erro no login:", error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("Erro ao fazer login. Tente novamente.");
  }
};

/**
 * Registra um novo usuário
 */
export const register = async (
  credentials: RegisterCredentials
): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>(
      "/auth/register",
      credentials
    );

    if (response.data.success) {
      saveAuthData(response.data.data);
    }

    return response.data;
  } catch (error: any) {
    console.error("Erro no registro:", error);

    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }

    throw new Error("Erro ao registrar usuário. Tente novamente.");
  }
};

/**
 * Realiza o logout do usuário
 */
export const logout = async (): Promise<void> => {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await api.post<LogoutResponse>("/auth/logout", { refreshToken });
    }
  } catch (error) {
    console.error("Erro no logout:", error);
  } finally {
    clearAuthData();
  }
};

/**
 * Renova o token de acesso
 */
export const refreshToken = async (): Promise<string> => {
  try {
    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      throw new Error("Refresh token não encontrado");
    }

    const response = await api.post<RefreshTokenResponse>("/auth/refresh", {
      refreshToken,
    });

    if (response.data.success) {
      if (typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_KEY, response.data.data.token);
        localStorage.setItem(
          REFRESH_TOKEN_KEY,
          response.data.data.refreshToken
        );
      }
      return response.data.data.token;
    }

    throw new Error("Falha ao renovar token");
  } catch (error: any) {
    console.error("Erro ao renovar token:", error);
    clearAuthData();
    throw error;
  }
};

/**
 * Verifica se o usuário está autenticado
 */
export const isAuthenticated = (): boolean => {
  if (typeof window === "undefined") return false;

  const token = getAccessToken();
  const user = getCurrentUser();

  if (!token || !user) {
    return false;
  }

  // Verifica se o token não expirou
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Date.now() / 1000;
    const isValid = payload.exp > now;

    return isValid;
  } catch (error) {
    console.error("🔍 Erro ao verificar token:", error);
    return false;
  }
};

/**
 * Obtém o token de acesso
 */
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Obtém o refresh token
 */
export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Obtém os dados do usuário atual
 */
export const getCurrentUser = (): User | null => {
  if (typeof window === "undefined") return null;

  const userData = localStorage.getItem(USER_KEY);
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
};

/**
 * Atualiza os dados do usuário no localStorage
 */
export const updateUser = (user: User): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};
