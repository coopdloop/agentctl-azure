import type { ErrorObject } from "ajv";
type V = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };
export const validateAgent: V;
export const validateChangeRequest: V;
