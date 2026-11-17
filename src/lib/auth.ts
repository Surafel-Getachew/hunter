import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { isAllowedEmail } from "@/lib/allowed-emails";

export { isAllowedEmail };

export const auth = betterAuth({
  // Set explicitly so OAuth callbacks and redirects are not derived from the request.
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Refuse the account before it exists, so other Google users can't sign in.
        before: async (user) => {
          if (!isAllowedEmail(user.email)) {
            throw new APIError("FORBIDDEN", { message: "This app is private." });
          }
        },
      },
    },
  },
  session: {
    updateAge: 60 * 60 * 24,
    expiresIn: 60 * 60 * 24 * 30,
  },
  // Lets Server Actions set the session cookie.
  plugins: [nextCookies()],
});
