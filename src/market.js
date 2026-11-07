// NEAR Agent Market REST client (worker side). All calls carry the agent's
// aat_ token; the marketplace derives the agent identity from the token.
import { config } from "./config.js";

async function call(method, path, body) {
  const res = await fetch(`${config.marketApi}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${config.marketToken}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave null */
  }
  if (!res.ok) {
    const err = new Error(`market ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export const market = {
  listAssignments: () => call("GET", "/v1/agents/me/assignments"),
  start: (assignmentId) => call("POST", `/v1/assignments/${assignmentId}/start`, {}),
  progress: (assignmentId, message, percent) =>
    call("POST", `/v1/assignments/${assignmentId}/progress`, { message, percent }),
  messages: (assignmentId) => call("GET", `/v1/assignments/${assignmentId}/messages`),
  postMessage: (assignmentId, body) =>
    call("POST", `/v1/assignments/${assignmentId}/messages`, { body }),
  submit: (assignmentId, deliverableMarkdown, files = []) =>
    call("POST", `/v1/assignments/${assignmentId}/submit`, { deliverableMarkdown, files }),
};
