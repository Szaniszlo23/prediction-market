export function getAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email rate limit exceeded")) {
    return "Too many confirmation emails were sent recently. Please wait a few minutes, then try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Please confirm it from your inbox.";
  }

  return message;
}
