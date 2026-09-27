/**
 * Email notification service.
 *
 * VECTRA_ISSUE[BUG-006]: sendWelcomeEmail calls an async helper but does not
 *   await it and does not attach a .catch() handler.
 *   If _dispatchEmail rejects (e.g. SMTP timeout), the rejection is silently
 *   swallowed and the caller receives no indication of failure.
 *   Fix: `await _dispatchEmail(...)` or attach `.catch(err => { throw err; })`.
 *   Severity: high | Category: async (unhandled promise rejection)
 *
 * VECTRA_ISSUE[QUALITY-002]: Dead code — the `legacySendEmail` function below
 *   is never called anywhere in the codebase.
 *   Severity: low | Category: quality (dead code)
 */

/**
 * Internal SMTP dispatcher (simulated).
 * @param {{ to: string, subject: string, body: string }} options
 */
async function _dispatchEmail(options) {
  // Simulated SMTP call — in real code this would call nodemailer or an API
  if (!options.to || !options.to.includes('@')) {
    throw new Error(`Invalid email address: ${options.to}`);
  }
  // Simulate success
  return { messageId: `msg-${Date.now()}`, accepted: [options.to] };
}

/**
 * Send a welcome email to a newly registered user.
 * VECTRA_ISSUE[BUG-006] — missing await on async call
 * @param {{ name: string, email: string }} user
 */
async function sendWelcomeEmail(user) {
  const payload = {
    to: user.email,
    subject: 'Welcome to the platform!',
    body: `Hi ${user.name}, your account has been created successfully.`,
  };

  // ❌ BUG-006: _dispatchEmail is async but not awaited — errors are silently lost
  _dispatchEmail(payload);

  return { queued: true };
}

/**
 * Send a password-reset email.
 * @param {{ email: string }} user
 * @param {string} resetToken
 */
async function sendPasswordResetEmail(user, resetToken) {
  return _dispatchEmail({
    to: user.email,
    subject: 'Password reset request',
    body: `Use this token to reset your password: ${resetToken}`,
  });
}

// VECTRA_ISSUE[QUALITY-002] — dead code, never referenced
function legacySendEmail(to, subject, message) {
  console.log(`[LEGACY] Sending to ${to}: ${subject}\n${message}`);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
