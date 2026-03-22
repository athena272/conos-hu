import { Request, Response } from "express";
import type { ResultSetHeader } from "mysql2";
import db from "../models/db";
import bcrypt from "bcryptjs";
import { signAuthToken } from "../services/authToken";
import type { UserRole } from "../types/roles";

interface UsuarioRow {
  idusuarios: number;
  email: string;
  password: string;
  role: UserRole;
}

function normalizeRole(value: unknown): UserRole {
  if (value === "admin") return "admin";
  return "viewer";
}

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    db.query(
      "SELECT * FROM usuarios WHERE email = ?",
      [email],
      async (err: Error | null, results: unknown) => {
        const rows = (results as UsuarioRow[]) || [];
        if (err) {
          console.error("Erro ao buscar usuário:", err);
          res.status(500).json({ message: "Erro no servidor", error: err.message });
          return;
        }

        if (rows.length > 0) {
          res.status(409).json({ message: "Usuário já cadastrado" });
          return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
          "INSERT INTO usuarios (email, password, role) VALUES (?, ?, 'viewer')",
          [email, hashedPassword],
          (insertErr: Error | null, insertResult: unknown) => {
            if (insertErr) {
              console.error("Erro ao registrar usuário:", insertErr);
              res.status(500).json({ message: "Erro no servidor", error: insertErr.message });
              return;
            }
            const header = insertResult as ResultSetHeader;
            const userId = header.insertId;
            const role: UserRole = "viewer";
            const token = signAuthToken({ userId, email, role });
            res.status(201).json({
              message: "Usuário criado com sucesso",
              userId,
              email,
              role,
              token,
            });
          }
        );
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Erro inesperado:", error);
    res.status(500).json({ message: "Erro no servidor", error: error.message });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    db.query(
      "SELECT idusuarios, email, password, role FROM usuarios WHERE email = ?",
      [email],
      async (err: Error | null, results: unknown) => {
        if (err) {
          console.error("Erro ao buscar usuário:", err);
          res.status(500).json({ message: "Erro no servidor", error: err.message });
          return;
        }

        const rows = (results as UsuarioRow[]) || [];
        if (rows.length === 0) {
          res.status(401).json({ message: "Usuário não encontrado" });
          return;
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
          res.status(401).json({ message: "Senha incorreta" });
          return;
        }

        const role = normalizeRole(user.role);
        const token = signAuthToken({
          userId: user.idusuarios,
          email: user.email,
          role,
        });

        res.status(200).json({
          message: "Login realizado com sucesso",
          userId: user.idusuarios,
          email: user.email,
          role,
          token,
        });
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error("Erro inesperado:", error);
    res.status(500).json({ message: "Erro no servidor", error: error.message });
  }
};
