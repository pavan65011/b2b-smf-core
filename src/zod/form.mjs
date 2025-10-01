import { z } from "zod";

export const formDataSchema = z.object({
  name: z.string().trim(),
  organization: z.string().trim(),
  phoneNumber: z.string().trim(),
  role: z.string().trim().optional(),
  emailId: z.string().email().trim().optional(),
});
