import bcrypt from "bcryptjs";

const COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// A pre-computed bcrypt hash (cost 12) of a random string. Used to run a real
// bcrypt comparison on the "user not found" path so login response timing does
// not reveal whether an email is registered (user enumeration defense).
const DUMMY_HASH = "$2b$12$BsnIpHd3Ow1posgfQCRXj.F2NK0vCdzmtUy62ZM8fWJ8.yECS213q";

/** Constant-time-ish dummy verification for the missing-user path. */
export async function dummyVerify(plain: string): Promise<void> {
  try {
    await bcrypt.compare(plain, DUMMY_HASH);
  } catch {
    // ignore — only here to consume comparable CPU time
  }
}
