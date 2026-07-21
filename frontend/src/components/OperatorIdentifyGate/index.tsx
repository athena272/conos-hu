import { ReactNode, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { api } from "../../api/client";
import { getAuth, needsOperatorIdentify, setAuth } from "../../auth/session";
import { normalizeErrorMessage } from "../../utils/errorMessages";
import type { IdentifyResponse } from "../../types/auth";
import "./styles.css";

interface OperatorIdentifyGateProps {
  children: ReactNode;
}

export default function OperatorIdentifyGate({ children }: OperatorIdentifyGateProps) {
  const mustIdentify = needsOperatorIdentify();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = nome.trim();
    if (trimmed.length < 2) {
      setError("Informe seu nome completo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body: { nome: string; cpf?: string } = { nome: trimmed };
      const cpfDigits = cpf.replace(/\D/g, "");
      if (cpfDigits.length > 0) {
        body.cpf = cpf;
      }

      const response = await api.post<IdentifyResponse>("/identify", body);
      const auth = getAuth();
      if (!auth) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }

      setAuth({
        ...auth,
        token: response.data.token,
        operadorNome: response.data.operador_nome,
      });
    } catch (err: unknown) {
      setError(normalizeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!mustIdentify) {
    return <>{children}</>;
  }

  return (
    <>
      <Dialog
        visible
        modal
        closable={false}
        draggable={false}
        header="Identificação do responsável"
        className="operator-identify-dialog"
        style={{ width: "min(28rem, 92vw)" }}
      >
        <p className="operator-identify-intro">
          Para registrar ações no histórico, informe quem está operando o sistema nesta sessão.
        </p>
        <div className="operator-identify-field">
          <label htmlFor="operador-nome">Nome completo *</label>
          <InputText
            id="operador-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full"
            autoFocus
            disabled={submitting}
          />
        </div>
        <div className="operator-identify-field">
          <label htmlFor="operador-cpf">CPF (opcional)</label>
          <InputText
            id="operador-cpf"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="w-full"
            placeholder="000.000.000-00"
            disabled={submitting}
          />
        </div>
        {error ? <p className="operator-identify-error">{error}</p> : null}
        <div className="operator-identify-actions">
          <Button
            label="Continuar"
            icon="pi pi-check"
            loading={submitting}
            onClick={() => void handleSubmit()}
          />
        </div>
      </Dialog>
      <div className="operator-identify-backdrop" aria-hidden="true">
        {children}
      </div>
    </>
  );
}
