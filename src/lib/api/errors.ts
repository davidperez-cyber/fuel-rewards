import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.', issues: err.issues } },
      { status: 400 },
    );
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } }, { status: 500 });
}
