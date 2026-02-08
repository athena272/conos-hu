import { createContext, useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Toast } from "primereact/toast";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const toast = useRef(null);
  const navigate = useNavigate();

  const login = async (email, password) => {
    try {
      const response = await axios.post("http://localhost:3001/login", {
        email,
        password,
      });

      setUser(response.data.user);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      toast.current.show({
        severity: "success",
        summary: "Sucesso!",
        detail: "Login realizado com sucesso!",
        life: 3000,
      });

      navigate("/home");
    } catch (error) {
      console.error("Erro ao fazer login:", error.response || error);

      const errorMessage =
        error.response?.data?.message || "Erro desconhecido. Tente novamente.";

      toast.current.show({
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
      <Toast ref={toast} />
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
