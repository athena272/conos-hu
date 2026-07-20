import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { coll } from "../models/mongo";
import { getNextId } from "../models/sequences";
import { signAuthToken } from "../services/authToken";
import { recordEvent } from "../services/eventService";
import type { UserRole } from "../types/roles";

interface UsuarioDoc {
  _id: number;
  email: string;
  password: string;
  role: UserRole;
  created_at?: Date;
}

function normalizeRole(value: unknown): UserRole {
  if (value === "admin") return "admin";
  return "viewer";
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
      detalhes: { email },
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
