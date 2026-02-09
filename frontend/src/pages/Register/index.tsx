import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import FloatLabelInput from "../../components/FloatLabelInput";
import Button from "../../components/ButtonSubmit";
import { Formik, Form, FormikHelpers } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";

import { API_BASE_URL } from "../../config/api";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import FullScreenLoader from "../../components/FullScreenLoader";
import registerImage from "../../assets/images/register.svg";
import "./styles.css";

interface RegisterValues {
  email: string;
  password: string;
  confirmPassword: string;
}

function Register() {
  const toast = useRef<Toast>(null);
  const navigate = useNavigate();

  const handleClickRegister = (
    values: RegisterValues,
    { setSubmitting }: FormikHelpers<RegisterValues>
  ) => {
    Axios.post(`${API_BASE_URL}/register`, {
      email: values.email,
      password: values.password,
    })
      .then((response: { data?: { userId?: number } }) => {
        if (response.data?.userId) {
          localStorage.setItem("userId", String(response.data.userId));
        }

        toast.current?.show({
          severity: "success",
          summary: "Sucesso!",
          detail: "Registro realizado!",
          life: 2000,
        });

        setTimeout(() => {
          navigate("/home");
        }, 2000);
      })
      .catch((error: unknown) => {
        setSubmitting(false);
        toast.current?.show({
          severity: "error",
          summary: "Erro!",
          detail: normalizeErrorMessage(error),
          life: 3000,
        });
      });
  };

  const validationRegister = yup.object().shape({
    email: yup
      .string()
      .email("Email inválido")
      .required("O email é obrigatório"),
    password: yup
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres")
      .required("A senha é obrigatória"),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref("password"), null], "As senhas não são iguais")
      .required("A confirmação da senha é obrigatória"),
  });

  return (
    <div className="container-primary">
      <Toast ref={toast} position="top-right" />
      <Formik
        initialValues={{ email: "", password: "", confirmPassword: "" }}
        onSubmit={handleClickRegister}
        validationSchema={validationRegister}
      >
        {({ isSubmitting }) => (
          <>
            <FullScreenLoader active={isSubmitting} message="Criando conta..." />
            <div className="container-secundary-one">
              <img src={registerImage} alt="Register" id="register-image" />
            </div>
            <div className="container-secundary-two">
              <h1>Inscreva-se</h1>
              <p>Vamos preparar você para que possa acessar sua conta pessoal.</p>

              <Form className="register-form">
                <div className="form-group">
                  <FloatLabelInput name="email" placeholder="Email" type="email" />
                </div>

                <div className="form-group">
                  <FloatLabelInput
                    name="password"
                    placeholder="Senha"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <FloatLabelInput
                    name="confirmPassword"
                    placeholder="Confirme sua senha"
                    type="password"
                    autoComplete="new-password"
                  />
                </div>

                <Button disabled={isSubmitting}>Criar</Button>
                <p style={{ color: "#393f81" }}>
                  Já tem uma conta?{" "}
                  <a href="/login" style={{ color: "#FF8682" }}>
                    Login
                  </a>
                </p>
              </Form>
            </div>
          </>
        )}
      </Formik>
    </div>
  );
}

export default Register;
