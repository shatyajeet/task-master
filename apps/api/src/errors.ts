import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface ErrorBody {
  error: string;
  message: string;
}

/** Thrown by routes. The error handler turns it into `{error, message}` with this status. */
export class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const KNOWN_CLIENT_ERRORS: Record<string, { status: number; error: string }> = {
  FST_ERR_CTP_BODY_TOO_LARGE: { status: 413, error: "too_large" },
  FST_ERR_CTP_INVALID_MEDIA_TYPE: { status: 415, error: "unsupported_type" },
};

/** Every error leaves the API as `{error, message}`. Server errors never reveal their text. */
export function registerErrors(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | HttpError, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ ...err.extra, error: err.code, message: err.message });
    }
    const fe = err as FastifyError;
    if (fe.validation) {
      return reply.status(400).send({ error: "validation", message: fe.message });
    }
    const known = fe.code ? KNOWN_CLIENT_ERRORS[fe.code] : undefined;
    if (known) {
      return reply.status(known.status).send({ error: known.error, message: fe.message });
    }
    const status = fe.statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.status(status).send({ error: "bad_request", message: fe.message });
    }
    request.log.error({ err }, "unhandled error");
    return reply.status(500).send({ error: "internal", message: "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: "not_found", message: "Route not found" }),
  );
}
