import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import FloatLabelInput from "../../components/FloatLabelInput";
import Button from "../../components/ButtonSubmit";
import { Formik, Form } from "formik";
import * as yup from "yup";
import Axios from "axios";
import { Toast } from "primereact/toast";
import registerImage from "../../assets/images/register.svg";
import "./styles.css";

function Register() {
  const toast = useRef(null);
  const navigate = useNavigate();

  const handleClickRegister = (values) => {
    Axios.post("http://localhost:3001/register", {
      email: values.email,
      password: values.password,
    })
      .then((response) => {
        localStorage.setItem("userId", response.data.userId);

        toast.current.show({
          severity: "success",
          summary: "Sucesso!",
          detail: "Registro realizado!",
          life: 2000, 
        });

        setTimeout(() => {
          navigate("/home");
        }, 2000);
      })
      .catch((error) => {
        toast.current.show({
          severity: "error",
          summary: "Erro!",
          detail: "Houve um problema ao registrar. Tente novamente.",
          life: 3000,
        });
        console.error(error);
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
      <Toast ref={toast} />
      <div className="container-secundary-one">
        <img src={registerImage} alt="Register" id="register-image" />
      </div>
      <div className="container-secundary-two">
        <h1>Inscreva-se</h1>
        <p>Vamos preparar você para que possa acessar sua conta pessoal.</p>
        <Formik
          initialValues={{ email: "", password: "", confirmPassword: "" }}
          onSubmit={handleClickRegister}
          validationSchema={validationRegister}
        >
          <Form className="register-form">
            <div className="form-group">
              <FloatLabelInput name="email" placeholder="Email" type="email" />
            </div>

            <div className="form-group">
              <FloatLabelInput
                name="password"
                placeholder="Senha"
                type="password"
              />
            </div>

            <div className="form-group">
              <FloatLabelInput
                name="confirmPassword"
                placeholder="Confirme sua senha"
                type="password"
              />
            </div>

            <Button>Criar</Button>
            <p style={{ color: "#393f81" }}>
              Já tem uma conta?{" "}
              <a href="/login" style={{ color: "#FF8682" }}>
                Login
              </a>
            </p>
          </Form>
        </Formik>
      </div>
    </div>
  );
}

export default Register;
