import { Formik, Form, FormikHelpers, Field, ErrorMessage } from "formik";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { AppDropdown } from "../../components/forms/AppDropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import LabelInput from "../../components/LabelInput";
import { FieldLabel } from "../../components/forms/FieldLabel";
import { buildDropdownFilterProps } from "../../components/forms/dropdownFilter";
import ButtonSubmit from "../../components/ButtonSubmit";
import { daysBetweenIsoDates } from "../../utils/dateUtils";
import type {
  MedicamentoDistinto,
  Paciente,
  RegimeConsumoMedicamento,
} from "../../types";
import { buildMedicamentoDropdownOptions } from "./medicamentoDropdownOptions";
import { DispensaDoDiaPaciente } from "./DispensaDoDiaPaciente";
import type { DispensaDoDiaMedicamentoOption } from "./DispensaDoDiaPaciente";
import {
  RETORNA_SERVICO_OPTIONS,
  TIPO_RETORNO_OPTIONS,
  REGIME_MEDICAMENTO_OPTIONS,
  initialMedicamentoItem,
  schemaCreate,
  schemaEdit,
  type FormValues,
  type MedicamentoFormItem,
} from "./pacienteFormModel";

export type PacienteFormDialogProps = {
  visible: boolean;
  editingPaciente: Paciente | null;
  initialValues: FormValues;
  medicamentosDistintos: MedicamentoDistinto[];
  loadingMedicamentosDistintos?: boolean;
  onHide: () => void;
  onSubmit: (
    values: FormValues,
    helpers: FormikHelpers<FormValues>,
  ) => void;
};

export function PacienteFormDialog({
  visible,
  editingPaciente,
  initialValues,
  medicamentosDistintos,
  loadingMedicamentosDistintos = false,
  onHide,
  onSubmit,
}: PacienteFormDialogProps) {
  const medicamentoDropdownOptions = buildMedicamentoDropdownOptions(
    medicamentosDistintos,
  );

  return (
    <Dialog
      header={editingPaciente ? "Editar paciente" : "Novo paciente"}
      visible={visible}
      onHide={onHide}
      draggable={false}
      style={{ width: "92vw", maxWidth: "560px" }}
      className="pacientes-form-dialog"
    >
      <Formik
        key={editingPaciente?.id ?? "new"}
        initialValues={initialValues}
        validationSchema={editingPaciente ? schemaEdit : schemaCreate}
        enableReinitialize
        onSubmit={onSubmit}
      >
        {({
          values,
          setFieldValue,
          setFieldTouched,
          isSubmitting,
          errors,
          touched,
        }) => (
          <Form>
            <div className="pacientes-form-fields">
              <LabelInput
                name="nome"
                label="Nome"
                placeholder="Digite o nome do paciente"
                required
              />
              <LabelInput
                name="prontuario"
                label="Prontuário"
                placeholder="Digite o número do prontuário"
                type="number"
                required
              />
              <LabelInput
                name="apac"
                label="APAC"
                placeholder="Digite a APAC"
                required
              />
              <div className="campo-texto">
                <Field name="diagnostico">
                  {({
                    field,
                    form,
                  }: {
                    field: Record<string, unknown>;
                    form: {
                      errors: Record<string, unknown>;
                      touched: Record<string, unknown>;
                    };
                  }) => (
                    <div className="input-container">
                      <FieldLabel
                        htmlFor="diagnostico"
                        label="Diagnóstico"
                        required
                      />
                      <InputTextarea
                        id="diagnostico"
                        {...field}
                        placeholder="Digite o diagnóstico"
                        rows={3}
                        aria-required
                        className={`w-full form-field ${form.errors.diagnostico && form.touched.diagnostico ? "p-invalid" : ""}`}
                      />
                    </div>
                  )}
                </Field>
                <ErrorMessage
                  component="span"
                  name="diagnostico"
                  className="form-error"
                />
              </div>
              <div className="campo-lista-medicamentos">
                <FieldLabel
                  label="Medicamentos (nome, concentração e regime de uso)"
                  required
                />
                <p className="pacientes-field-hint">
                  Selecione pelo nome e concentração. O paciente fica
                  vinculado ao medicamento, não a um lote específico; o
                  estoque considera todos os lotes desse medicamento.
                </p>
                {(values.medicamentos ?? []).map((_, index) => {
                  const itemError = Array.isArray(errors.medicamentos)
                    ? (errors.medicamentos[index] as
                        | {
                            medicamento?: string;
                            consumo_diario?: string;
                            unidades_por_ciclo?: string;
                            intervalo_ciclo_dias?: string;
                          }
                        | undefined)
                    : undefined;
                  const itemTouched =
                    Array.isArray(touched.medicamentos) &&
                    touched.medicamentos[index] &&
                    typeof touched.medicamentos[index] === "object"
                      ? (touched.medicamentos[index] as {
                          medicamento?: boolean;
                          consumo_diario?: boolean;
                          unidades_por_ciclo?: boolean;
                          intervalo_ciclo_dias?: boolean;
                        })
                      : undefined;
                  const regimeAtual =
                    values.medicamentos[index]?.regime_consumo ?? "diario";
                  return (
                  <div key={index} className="pacientes-medicamento-row">
                    <Button
                      type="button"
                      icon="pi pi-trash"
                      className="p-button-text p-button-sm pacientes-remove-med-icon"
                      disabled={(values.medicamentos?.length ?? 0) <= 1}
                      onClick={() => {
                        const next = (values.medicamentos ?? []).filter(
                          (_, i) => i !== index,
                        );
                        if (next.length >= 1)
                          setFieldValue("medicamentos", next);
                      }}
                      title="Remover medicamento"
                      aria-label="Remover medicamento"
                    />

                    <div className="pacientes-medicamento-main">
                      <div className="campo-dropdown pacientes-medicamento-campo">
                        <Field name={`medicamentos.${index}.medicamento`}>
                          {({
                            form,
                          }: {
                            form: {
                              setFieldValue: (
                                _field: string,
                                _value: unknown,
                              ) => void;
                              setFieldTouched: (
                                field: string,
                                touched: boolean,
                              ) => void;
                              errors: Record<string, unknown>;
                              touched: Record<string, unknown>;
                            };
                          }) => {
                            const med =
                              values.medicamentos[index]?.medicamento ?? null;
                            const dropdownValue =
                              med == null
                                ? null
                                : (medicamentoDropdownOptions.find(
                                    (o) =>
                                      o.value &&
                                      o.value.nome === med.nome &&
                                      o.value.concentracao ===
                                        med.concentracao,
                                  )?.value ?? null);

                            const hasMedicamentoError =
                              !!itemError?.medicamento &&
                              !!itemTouched?.medicamento;

                            return (
                              <div className="input-container">
                                <FieldLabel
                                  htmlFor={`medicamento-${index}`}
                                  label="Medicamento"
                                  required
                                />
                                <AppDropdown
                                  inputId={`medicamento-${index}`}
                                  name={`medicamentos.${index}.medicamento`}
                                  value={dropdownValue}
                                  options={medicamentoDropdownOptions}
                                  disabled={loadingMedicamentosDistintos}
                                  placeholder={
                                    loadingMedicamentosDistintos
                                      ? "Carregando medicamentos..."
                                      : "Selecione o medicamento"
                                  }
                                  optionLabel="label"
                                  optionValue="value"
                                  {...buildDropdownFilterProps({
                                    id: `medicamento-busca-${index}`,
                                    placeholder: "Digite para buscar o medicamento",
                                  })}
                                  filterBy="label"
                                  showClear
                                  aria-required
                                  onChange={(e: {
                                    value: MedicamentoDistinto | null;
                                  }) => {
                                    setFieldValue(
                                      `medicamentos.${index}.medicamento`,
                                      e.value,
                                    );
                                    form.setFieldTouched(
                                      `medicamentos.${index}.medicamento`,
                                      true,
                                    );
                                  }}
                                  onBlur={() =>
                                    setFieldTouched(
                                      `medicamentos.${index}.medicamento`,
                                      true,
                                    )
                                  }
                                  className={`w-full ${hasMedicamentoError ? "p-invalid" : ""}`}
                                />
                              </div>
                            );
                          }}
                        </Field>
                        <ErrorMessage
                          component="span"
                          name={`medicamentos.${index}.medicamento`}
                          className="form-error"
                        />
                      </div>

                      <div className="campo-dropdown pacientes-medicamento-campo">
                        <FieldLabel
                          htmlFor={`regime-${index}`}
                          label="Regime de uso"
                          required
                        />
                        <AppDropdown
                          inputId={`regime-${index}`}
                          name={`medicamentos.${index}.regime_consumo`}
                          value={regimeAtual}
                          options={REGIME_MEDICAMENTO_OPTIONS}
                          aria-required
                          onChange={(e: { value: RegimeConsumoMedicamento }) => {
                            setFieldValue(
                              `medicamentos.${index}.regime_consumo`,
                              e.value,
                            );
                            setFieldTouched(
                              `medicamentos.${index}.regime_consumo`,
                              true,
                            );
                          }}
                          onBlur={() =>
                            setFieldTouched(
                              `medicamentos.${index}.regime_consumo`,
                              true,
                            )
                          }
                          placeholder="Selecione o regime de uso"
                          className="w-full"
                        />
                      </div>

                      {regimeAtual === "diario" ? (
                        <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo">
                          <Field name={`medicamentos.${index}.consumo_diario`}>
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const hasConsumoError =
                                !!itemError?.consumo_diario &&
                                !!itemTouched?.consumo_diario;
                              return (
                                <div className="input-container">
                                  <FieldLabel
                                    htmlFor={`consumo-${index}`}
                                    label="Consumo/dia"
                                    required
                                  />
                                  <InputText
                                    id={`consumo-${index}`}
                                    {...field}
                                    placeholder="Digite o consumo por dia"
                                    type="number"
                                    aria-required
                                    className={`form-field ${hasConsumoError ? "p-invalid" : ""}`}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.consumo_diario`}
                            className="form-error"
                          />
                        </div>
                      ) : regimeAtual === "por_miligrama" ? (
                        <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo pacientes-medicamento-ciclo">
                          <Field name={`medicamentos.${index}.consumo_mg_diario`}>
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const hasErr =
                                !!itemError?.consumo_mg_diario &&
                                !!itemTouched?.consumo_mg_diario;
                              return (
                                <div className="input-container">
                                  <FieldLabel
                                    htmlFor={`consumo-mg-${index}`}
                                    label="Consumo (mg)"
                                    required
                                  />
                                  <InputText
                                    id={`consumo-mg-${index}`}
                                    {...field}
                                    placeholder="Digite o consumo em mg"
                                    type="number"
                                    aria-required
                                    className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                    tooltip="Quantidade total em miligramas administrada no intervalo informado ao lado. Com intervalo = 1, equivale a mg/dia."
                                    tooltipOptions={{
                                      position: "top",
                                      className: "pacientes-ciclo-tooltip",
                                    }}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.consumo_mg_diario`}
                            className="form-error"
                          />
                          <Field
                            name={`medicamentos.${index}.intervalo_ciclo_dias`}
                          >
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const hasErr =
                                !!itemError?.intervalo_ciclo_dias &&
                                !!itemTouched?.intervalo_ciclo_dias;
                              return (
                                <div className="input-container">
                                  <FieldLabel
                                    htmlFor={`mg-intervalo-${index}`}
                                    label="a cada (dias)"
                                    required
                                  />
                                  <InputText
                                    id={`mg-intervalo-${index}`}
                                    {...field}
                                    placeholder="Digite o intervalo em dias"
                                    type="number"
                                    aria-required
                                    className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                    tooltip="Em quantos dias a quantidade de mg ao lado é consumida (ex.: 750 mg a cada 28 dias). Deixe 1 para informar mg/dia."
                                    tooltipOptions={{
                                      position: "top",
                                      className: "pacientes-ciclo-tooltip",
                                    }}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.intervalo_ciclo_dias`}
                            className="form-error"
                          />
                        </div>
                      ) : (
                        <div className="campo-consumo-row pacientes-medicamento-campo pacientes-medicamento-consumo pacientes-medicamento-ciclo">
                          <Field
                            name={`medicamentos.${index}.unidades_por_ciclo`}
                          >
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const hasErr =
                                !!itemError?.unidades_por_ciclo &&
                                !!itemTouched?.unidades_por_ciclo;
                              return (
                                <div className="input-container">
                                  <FieldLabel
                                    htmlFor={`unidades-ciclo-${index}`}
                                    label="Unidades por ciclo"
                                    required
                                  />
                                  <InputText
                                    id={`unidades-ciclo-${index}`}
                                    {...field}
                                    placeholder="Digite as unidades por ciclo"
                                    type="number"
                                    aria-required
                                    className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                    tooltip="Quantas unidades de estoque (comprimidos, seringas, etc., conforme o cadastro) são dispensadas de uma vez para cobrir até a próxima retirada."
                                    tooltipOptions={{
                                      position: "top",
                                      className: "pacientes-ciclo-tooltip",
                                    }}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.unidades_por_ciclo`}
                            className="form-error"
                          />
                          <Field
                            name={`medicamentos.${index}.intervalo_ciclo_dias`}
                          >
                            {({
                              field,
                            }: {
                              field: Record<string, unknown>;
                            }) => {
                              const hasErr =
                                !!itemError?.intervalo_ciclo_dias &&
                                !!itemTouched?.intervalo_ciclo_dias;
                              return (
                                <div className="input-container">
                                  <FieldLabel
                                    htmlFor={`intervalo-ciclo-${index}`}
                                    label="Intervalo (dias)"
                                    required
                                  />
                                  <InputText
                                    id={`intervalo-ciclo-${index}`}
                                    {...field}
                                    placeholder="Digite o intervalo do ciclo em dias"
                                    type="number"
                                    aria-required
                                    className={`form-field ${hasErr ? "p-invalid" : ""}`}
                                    tooltip="Quantos dias, em média, entre uma dispensação deste medicamento e a próxima (ex.: até o retorno agendado). Usado para calcular o consumo médio por dia no estoque."
                                    tooltipOptions={{
                                      position: "top",
                                      className: "pacientes-ciclo-tooltip",
                                    }}
                                  />
                                </div>
                              );
                            }}
                          </Field>
                          <ErrorMessage
                            component="span"
                            name={`medicamentos.${index}.intervalo_ciclo_dias`}
                            className="form-error"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
                <Button
                  type="button"
                  label="Adicionar medicamento"
                  icon="pi pi-plus"
                  className="p-button-outlined p-button-sm"
                  onClick={() =>
                    setFieldValue("medicamentos", [
                      ...(values.medicamentos ?? []),
                      { ...initialMedicamentoItem },
                    ])
                  }
                />
                <ErrorMessage name="medicamentos">
                  {(msg) => {
                    const text =
                      typeof msg === "string"
                        ? msg
                        : Array.isArray(msg) ||
                            (msg && typeof msg === "object")
                          ? "Verifique os itens da lista de medicamentos."
                          : "";
                    return text ? (
                      <span className="form-error">{text}</span>
                    ) : null;
                  }}
                </ErrorMessage>
              </div>
              <div className="campo-texto">
                <Field name="observacoes">
                  {({
                    field,
                    form,
                  }: {
                    field: Record<string, unknown>;
                    form: {
                      errors: Record<string, unknown>;
                      touched: Record<string, unknown>;
                    };
                  }) => (
                    <div className="input-container">
                      <label htmlFor="observacoes" className="input-label">
                        Observações (opcional)
                      </label>
                      <InputTextarea
                        id="observacoes"
                        {...field}
                        placeholder="Digite as observações, se desejar"
                        rows={3}
                        className={`w-full form-field ${form.errors.observacoes && form.touched.observacoes ? "p-invalid" : ""}`}
                      />
                    </div>
                  )}
                </Field>
                <ErrorMessage
                  component="span"
                  name="observacoes"
                  className="form-error"
                />
              </div>
              <LabelInput
                name="telefone"
                label="Telefone (opcional)"
                placeholder="Digite o telefone"
              />
              <LabelInput
                name="data_liberacao"
                label="Data de liberação"
                type="date"
                placeholder="Selecione a data de liberação"
                required
              />
              <div className="campo-dropdown">
                <FieldLabel
                  htmlFor="retorna_servico"
                  label="O paciente vai retornar para o serviço?"
                  required
                />
                <AppDropdown
                  inputId="retorna_servico"
                  name="retorna_servico"
                  value={values.retorna_servico}
                  options={RETORNA_SERVICO_OPTIONS}
                  onChange={(e: { value: boolean }) =>
                    setFieldValue("retorna_servico", e.value)
                  }
                  placeholder="Selecione sim ou não"
                  className="w-full"
                  aria-required
                />
              </div>
              {values.retorna_servico && (
                <div className="campo-dropdown">
                  <FieldLabel
                    htmlFor="tipo_retorno"
                    label="Tipo de retorno"
                    required
                  />
                  <Field name="tipo_retorno">
                    {({
                      form,
                    }: {
                      form: {
                        setFieldValue: (
                          _field: string,
                          _value: unknown,
                        ) => void;
                        setFieldTouched: (
                          field: string,
                          touched: boolean,
                        ) => void;
                        errors: Record<string, unknown>;
                        touched: Record<string, unknown>;
                      };
                    }) => (
                      <AppDropdown
                        inputId="tipo_retorno"
                        name="tipo_retorno"
                        value={values.tipo_retorno}
                        options={TIPO_RETORNO_OPTIONS}
                        onChange={(e: { value: string }) => {
                          setFieldValue("tipo_retorno", e.value);
                          form.setFieldTouched("tipo_retorno", true);
                        }}
                        onBlur={() => setFieldTouched("tipo_retorno", true)}
                        placeholder="Selecione o tipo de retorno"
                        aria-required
                        className={`w-full ${errors.tipo_retorno && touched.tipo_retorno ? "p-invalid" : ""}`}
                      />
                    )}
                  </Field>
                  <ErrorMessage
                    component="span"
                    name="tipo_retorno"
                    className="form-error"
                  />
                </div>
              )}
              {values.retorna_servico && (
                <>
                  <LabelInput
                    name="data_retorno"
                    label="Data de retorno"
                    type="date"
                    placeholder="Selecione a data de retorno"
                    required
                  />
                  {editingPaciente ? (
                    <p className="pacientes-field-hint">
                      Alterar esta data agenda um novo retorno. Se permanecer
                      igual à próxima já cadastrada, nada é inserido de novo.
                    </p>
                  ) : null}
                  {(() => {
                    const dias = daysBetweenIsoDates(
                      values.data_liberacao,
                      values.data_retorno,
                    );
                    if (dias == null) return null;
                    return (
                      <p
                        className="pacientes-dias-retorno"
                        role="status"
                        aria-live="polite"
                      >
                        <span className="pacientes-dias-retorno-valor">
                          {dias === 1 ? "1 dia" : `${dias} dias`}
                        </span>
                        <span className="pacientes-dias-retorno-label">
                          {" "}
                          entre a liberação e o retorno
                        </span>
                      </p>
                    );
                  })()}
                </>
              )}
              {editingPaciente && (
                <DispensaDoDiaPaciente
                  pacienteId={editingPaciente.id}
                  pacienteNome={values.nome}
                  medicamentos={values.medicamentos
                    .filter(
                      (m): m is MedicamentoFormItem & { medicamento: MedicamentoDistinto } =>
                        Boolean(m.medicamento?.nome && m.medicamento?.concentracao),
                    )
                    .map((m, idx): DispensaDoDiaMedicamentoOption => ({
                      key: `${m.medicamento.nome}\0${m.medicamento.concentracao}\0${idx}`,
                      label: `${m.medicamento.nome} - ${m.medicamento.concentracao}`,
                      nome: m.medicamento.nome,
                      concentracao: m.medicamento.concentracao,
                      regime_consumo: m.regime_consumo,
                      unidades_por_ciclo: m.unidades_por_ciclo,
                    }))}
                />
              )}
            </div>
            <div className="pacientes-form-footer">
              <Button
                type="button"
                label="Cancelar"
                className="p-button-text"
                onClick={onHide}
              />
              <ButtonSubmit type="submit" disabled={isSubmitting}>
                {editingPaciente ? "Salvar" : "Salvar e confirmar"}
              </ButtonSubmit>
            </div>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
}
