export function isActiveServiceStatus(status: unknown): status is "active" {
  return status === "active";
}
