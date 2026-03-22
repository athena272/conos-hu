import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form } from "formik";
import * as yup from "yup";
import { Toast } from "primereact/toast";

import { api } from "../../api/client";
import { setAuth, type UserRole } from "../../auth/session";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FloatLabelInput from "../../components/FloatLabelInput";
import ButtonSubmit from "../../components/ButtonSubmit";
import FullScreenLoader from "../../components/FullScreenLoader";
import loginImage from "../../assets/images/login.svg";

import "./styles.css";

interface LoginValues {
  email: string;
  password: string;
}

function Login() {
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();
  const validationLogin = yup.object().shape({
    email: yup
      .string()
      .email("Email inválido")
      .required("O email é obrigatório"),
    password: yup
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .required("A senha é obrigatória"),
  });

  const handleClickLogin = async (values: LoginValues) => {
    try {
      const response = await api.post<{
        userId: number;
        email: string;
        role: UserRole;
        token: string;
        message: string;
      }>("/login", {
        email: values.email,
        password: values.password,
      });

      setAuth({
        token: response.data.token,
        userId: response.data.userId,
        email: response.data.email,
        role: response.data.role,
      });

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: response.data.message,
        life: 3000,
      });

      navigate("/home");
    } catch (error: unknown) {
      console.error("Erro ao fazer login:", error);
      toast.current?.show({
        severity: "error",
        summary: "Erro!",
        detail: normalizeErrorMessage(error),
        life: 3000,
      });
    }
  };

  return (
    <div className="container-primary">
      <Toast ref={toast} position="top-right" />
      <Formik
        initialValues={{ email: "", password: "" }}
        onSubmit={handleClickLogin}
        validationSchema={validationLogin}
      >
        {({ isSubmitting }) => (
          <>
            <FullScreenLoader active={isSubmitting} message="Entrando..." />
            <div className="container-secundary-one">
              <img src={loginImage} alt="Login" id="login-image" />
            </div>
            <div className="container-secundary-two">
              <h1>Login</h1>
              <p>Faça login para acessar sua conta.</p>

              <Form className="login-form">
                <FloatLabelInput name="email" placeholder="Email" type="email" autoComplete="username" />
                <FloatLabelInput
                  name="password"
                  placeholder="Senha"
                  type="password"
                  autoComplete="current-password"
                />
                <ButtonSubmit disabled={isSubmitting}>
                  Entrar
                </ButtonSubmit>
              </Form>

              <p style={{ color: "#393f81" }}>
                Não tem uma conta? <a href="/register">Cadastre-se.</a>
              </p>
            </div>
          </>
        )}
      </Formik>
    </div>
  );
}

export default Login;
