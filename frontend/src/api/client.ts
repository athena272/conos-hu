import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { clearAuth, getToken } from "../auth/session";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401 && getToken()) {
      clearAuth();
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/register")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
