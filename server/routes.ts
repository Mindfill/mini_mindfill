import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  app.post("/api/try-it-out", (req: Request, res: Response) => {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";

    if (!prompt) {
      return res.status(400).json({ message: "Prompt is required." });
    }

    const response = [
      "Mindfill received your instruction:",
      "",
      `“${prompt}”`,
      "",
      "We mirror it back to you here, the same way the sandbox endpoint would proxy a foundation model. Join the beta to unlock the full layered reasoning engine.",
    ].join("\n");

    return res.json({ response });
  });

  const httpServer = createServer(app);

  return httpServer;
}
