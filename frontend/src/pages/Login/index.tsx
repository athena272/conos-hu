import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Formik, Form } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";

import { API_BASE_URL } from "../../config/api";
import FloatLabelInput from "../../components/FloatLabelInput";
import ButtonSubmit from "../../components/ButtonSubmit";
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
      const response = await Axios.post<{ userId: number; message: string }>(
        `${API_BASE_URL}/login`,
        {
          email: values.email,
          password: values.password,
        }
      );

      localStorage.setItem("userId", String(response.data.userId));

      navigate("/home");

      toast.current?.show({
        severity: "success",
        summary: "Sucesso!",
        detail: response.data.message,
        life: 3000,
      });
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

  return (
    <div className="container-primary">
      <Toast ref={toast} />
      <div className="container-secundary-one">
        <img src={loginImage} alt="Login" id="login-image" />
      </div>
      <div className="container-secundary-two">
        <h1>Login</h1>
        <p>Faça login para acessar sua conta.</p>

        <Formik
          initialValues={{ email: "", password: "" }}
          onSubmit={handleClickLogin}
          validationSchema={validationLogin}
        >
          <Form className="login-form">
            <FloatLabelInput name="email" placeholder="Email" type="email" />
            <FloatLabelInput
              name="password"
              placeholder="Senha"
              type="password"
              autoComplete="current-password"
            />
            <ButtonSubmit>Entrar</ButtonSubmit>
          </Form>
        </Formik>

        <p style={{ color: "#393f81" }}>
          Não tem uma conta? <a href="/register">Cadastre-se.</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
