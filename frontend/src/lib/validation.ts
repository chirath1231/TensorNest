/** Client-side validation for the auth forms.
 *
 *  These rules deliberately mirror the backend's Pydantic schema
 *  (`backend/app/schemas/auth.py`): password 8-128, name 1-255, and an email
 *  the `email-validator` package will accept. The server stays the authority —
 *  this only exists so a user learns about a bad field before a round trip,
 *  and so the message they see names the field instead of being a raw 422.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 255;

// Deliberately permissive: one @, something either side, a dotted domain with
// a 2+ char TLD. Anything stricter starts rejecting addresses that are legal.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

// The backend's email-validator rejects RFC 2606 / 6761 special-use domains,
// which is a confusing 422 if the frontend lets them through silently.
const SPECIAL_USE_DOMAINS = ["local", "test", "invalid", "example", "localhost"];

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Email is required.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";

  const tld = email.split("@")[1]?.split(".").pop()?.toLowerCase();
  if (tld && SPECIAL_USE_DOMAINS.includes(tld)) {
    return `".${tld}" is a reserved domain the server rejects. Use a real domain.`;
  }
  return null;
}

export function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Name is required.";
  if (name.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer.`;
  return null;
}

/** Presence/length only — strength is advisory and scored separately. */
export function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (value.length > PASSWORD_MAX) {
    return `Password must be ${PASSWORD_MAX} characters or fewer.`;
  }
  return null;
}

export function validateLoginPassword(value: string): string | null {
  return value ? null : "Password is required.";
}

/* ------------------------------------------------------------------ *
 * Password strength
 * ------------------------------------------------------------------ */

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  /** 0 = too short, 1 = weak, 2 = fair, 3 = good, 4 = strong. */
  score: StrengthLevel;
  label: string;
  /** Single most useful thing the user could do next, or null when strong. */
  advice: string | null;
  checks: { label: string; met: boolean }[];
}

// Scoring is a heuristic, not an entropy oracle: full zxcvbn would add ~800 KB
// to the bundle to grade a field the server does not gate on. What it does do
// is reward length above all (which is what actually matters) and refuse to
// call a password strong just because it hit four character classes.
const COMMON = new Set([
  "password", "passw0rd", "password1", "password123", "123456", "12345678",
  "123456789", "qwerty", "qwerty123", "abc123", "letmein", "welcome",
  "monkey", "dragon", "iloveyou", "admin", "administrator", "root", "toor",
  "login", "master", "sunshine", "princess", "football", "baseball",
  "trustno1", "changeme", "secret", "hello123", "test123", "temp123",
]);

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl"];

function hasSequence(lower: string): boolean {
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const run = seq.slice(i, i + 4);
      if (lower.includes(run) || lower.includes([...run].reverse().join(""))) return true;
    }
  }
  return false;
}

export function scorePassword(password: string): PasswordStrength {
  const lower = password.toLowerCase();
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  const checks = [
    { label: `${PASSWORD_MIN}+ characters`, met: password.length >= PASSWORD_MIN },
    { label: "Upper & lowercase", met: hasLower && hasUpper },
    { label: "A number", met: hasDigit },
    { label: "A symbol", met: hasSymbol },
  ];

  if (!password) {
    return { score: 0, label: "", advice: null, checks };
  }
  if (password.length < PASSWORD_MIN) {
    return {
      score: 0,
      label: "Too short",
      advice: `Use at least ${PASSWORD_MIN} characters.`,
      checks,
    };
  }

  // Strip a trailing digit run before the dictionary check, so "password123"
  // is still recognised as the word everyone actually typed.
  const stem = lower.replace(/\d+$/, "").replace(/[^a-z]/g, "");
  if (COMMON.has(lower) || (stem.length >= 5 && COMMON.has(stem))) {
    return {
      score: 1,
      label: "Weak",
      advice: "This is a commonly used password. Pick something less predictable.",
      checks,
    };
  }

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (classes >= 2) points += 1;
  if (classes >= 3) points += 1;
  if (classes === 4) points += 1;

  // Penalties for the patterns that make a long password no better than a short one.
  if (/^(.)\1+$/.test(password)) points -= 3;          // "aaaaaaaa"
  else if (/(.)\1{2,}/.test(password)) points -= 1;    // "aaa" anywhere
  if (hasSequence(lower)) points -= 1;
  if (/^\d+$/.test(password)) points -= 2;             // digits only
  if (new Set(password).size <= 3) points -= 1;        // tiny alphabet

  const score = (points <= 1 ? 1 : points <= 3 ? 2 : points <= 4 ? 3 : 4) as StrengthLevel;

  let advice: string | null = null;
  if (score < 4) {
    if (password.length < 12) advice = "Longer is stronger — aim for 12+ characters.";
    else if (!hasSymbol) advice = "Add a symbol to strengthen it.";
    else if (!(hasUpper && hasLower)) advice = "Mix upper and lowercase letters.";
    else if (!hasDigit) advice = "Add a number to strengthen it.";
    else advice = "Avoid repeated characters and keyboard runs.";
  }

  return {
    score,
    label: ["", "Weak", "Fair", "Good", "Strong"][score],
    advice,
    checks,
  };
}
