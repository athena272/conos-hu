import { createContext, useContext, useState, useRef, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../utils/errorMessages";
import { Toast } from "primereact/toast";

interface AuthContextType {
  user: { id: number; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<{ id: number; email: string } | null>(null);
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post<{ userId: number; message: string }>(
        `${API_BASE_URL}/login`,
        { email, password }
      );

      const userData = { id: response.data.userId, email };
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));

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
