import { createContext, useContext, useState, useRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { UserRole } from "../../auth/session";
import { setAuth } from "../../auth/session";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import { Toast } from "primereact/toast";

interface AuthContextType {
  user: { id: number; email: string; role: UserRole } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<{ id: number; email: string; role: UserRole } | null>(
    null
  );
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post<{
        userId: number;
        email: string;
        role: UserRole;
        token: string;
        message: string;
      }>("/login", { email, password });

      const userData = {
        id: response.data.userId,
        email: response.data.email,
        role: response.data.role,
      };
      setUser(userData);
      setAuth({
        token: response.data.token,
        userId: response.data.userId,
        email: response.data.email,
        role: response.data.role,
      });

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Login realizado com sucesso!",
        life: 3000,
      });

      navigate("/home");
    } catch (error: unknown) {
      console.error("Erro ao fazer login:", error);

      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage =
        err.response?.data?.message || "Erro desconhecido. Tente novamente.";

      toast.current?.show({
        severity: "error",
        summary: "Erro!",
        detail: errorMessage,
        life: 3000,
      });
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("auth");
    localStorage.removeItem("userId");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Toast ref={toast} position="top-right" />
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
