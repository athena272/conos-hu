import "../load-env";
import type { Request, Response } from "express";
import app from "../app";
import { connectMongo } from "../models/mongo";
import { getJwtSecret } from "../services/authToken";

let initPromise: Promise<void> | null = null;

function ensureMongo(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await connectMongo();
      getJwtSecret();
    })();
  }
  return initPromise;
}

export default async (req: Request, res: Response): Promise<void> => {
  await ensureMongo();
  app(req, res);
};
