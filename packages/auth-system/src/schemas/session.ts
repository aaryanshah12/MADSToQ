import { z } from "zod";

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  clientId: z.string(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
