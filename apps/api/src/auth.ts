import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

// better-auth manages its own DB connection for user/session tables
const authDb = new Database(new URL("../wapu.db", import.meta.url).pathname);

export const auth = betterAuth({
  basePath: "/auth",
  baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "change-me-in-production",
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  trustedOrigins: [process.env.PLATFORM_URL ?? "http://localhost:5173", "http://localhost:4173"],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
