// Returns true if the given email is in the ADMIN_EMAIL env var.
// ADMIN_EMAIL may contain a single email or comma-separated list.
export function isAdminEmail(email) {
  if (!email || !process.env.ADMIN_EMAIL) return false
  return process.env.ADMIN_EMAIL
    .split(',')
    .map(e => e.trim().toLowerCase())
    .includes(email.toLowerCase())
}
