import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { coll } from "../models/mongo";
import { getNextId } from "../models/sequences";
import { signAuthToken } from "../services/authToken";
import { recordEventFromRequest, buildAuditDetalhes } from "../utils/auditContext";
import { recordEvent } from "../services/eventService";
import { isElevated } from "../utils/permissions";
import { getClientIp, getUserAgent } from "../utils/requestContext";
import type { UserRole } from "../types/roles";
import { isUserRole } from "../types/roles";

interface UsuarioDoc {
  _id: number;
  email: string;
  password: string;
  role: UserRole;
  created_at?: Date;
}

export function normalizeRole(value: unknown): UserRole {
  if (isUserRole(value)) return value;
  return "viewer";
}

const NOME_MIN = 2;
const NOME_MAX = 120;

function normalizeNome(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < NOME_MIN || trimmed.length > NOME_MAX) return null;
  return trimmed;
}

function normalizeCpfOptional(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const existing = await coll<UsuarioDoc>("usuarios").findOne({ email });
    if (existing) {
      res.status(409).json({ message: "Usuário já cadastrado" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = await getNextId("usuarios");
    const role: UserRole = "viewer";
    await coll<UsuarioDoc>("usuarios").insertOne({
      _id: id,
      email,
      password: hashedPassword,
      role,
      created_at: new Date(),
    });

    await recordEvent({
      usuario_id: id,
      acao: "usuario.register",
      entidade_tipo: "usuario",
      entidade_id: id,
      detalhes: buildAuditDetalhes(req, { email }),
    });

    const token = signAuthToken({ userId: id, email, role });
    res.status(201).json({
      message: "Usuário criado com sucesso",
      userId: id,
      email,
      role,
      token,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Erro inesperado:", error);
    res.status(500).json({ message: "Erro no servidor", error: error.message });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await coll<UsuarioDoc>("usuarios").findOne({ email });
    if (!user) {
      res.status(401).json({ message: "Usuário não encontrado" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Senha incorreta" });
      return;
    }

    const role = normalizeRole(user.role);
    const token = signAuthToken({
      userId: user._id,
      email: user.email,
      role,
    });

    res.status(200).json({
      message: "Login realizado com sucesso",
      userId: user._id,
      email: user.email,
      role,
      token,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Erro inesperado:", error);
    res.status(500).json({ message: "Erro no servidor", error: error.message });
  }
};

/** Identificação do operador na sessão (obrigatória para papéis elevados antes de ações de escrita). */
export const identifyOperator = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }

  if (!isElevated(req.user.role)) {
    res.status(403).json({ message: "Identificação não necessária para este perfil" });
    return;
  }

  const nome = normalizeNome(req.body?.nome);
  if (!nome) {
    res.status(400).json({
      message: `Informe seu nome completo (${NOME_MIN} a ${NOME_MAX} caracteres)`,
    });
    return;
  }

  const cpfRaw = req.body?.cpf;
  let cpf: string | null = null;
  if (cpfRaw != null && String(cpfRaw).trim() !== "") {
    cpf = normalizeCpfOptional(cpfRaw);
    if (!cpf) {
      res.status(400).json({ message: "CPF inválido (informe 11 dígitos ou deixe em branco)" });
      return;
    }
  }

  try {
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    await recordEventFromRequest(req, {
      acao: "usuario.identify",
      entidade_tipo: "usuario",
      entidade_id: req.user.id,
      detalhes: {
        nome,
        operador_nome: nome,
        ...(cpf ? { cpf } : {}),
        ip: ip ?? undefined,
        user_agent: userAgent ?? undefined,
      },
    });

    const token = signAuthToken({
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      operador_nome: nome,
    });

    res.status(200).json({
      message: "Identificação registrada",
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      operador_nome: nome,
      token,
    });
  } catch (err) {
    const error = err as Error;
    console.error("Erro ao identificar operador:", error);
    res.status(500).json({ message: "Erro no servidor", error: error.message });
  }
};
