const MAX_BODY_BYTES = 1024 * 1024;

export function createHttpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

export function sendNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end();
}

export function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, {
    error: message,
    ...(details ? { details } : {})
  });
}

export function sendNotFound(response, message = "Not found.") {
  sendError(response, 404, message);
}

export function sendRequestError(response, error) {
  const statusCode = error?.statusCode ?? 500;
  const message =
    error?.message ||
    (statusCode >= 500 ? "Internal server error." : "Request failed.");

  sendError(response, statusCode, message, error?.details);
}

export function sendServerError(response, error) {
  sendRequestError(response, error);
}

export function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(createHttpError(400, "Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(createHttpError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", (error) => {
      reject(error);
    });
  });
}
