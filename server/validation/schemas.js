"use strict";

const { z } = require("zod");

// Error messages here are machine codes. The frontend translates them into
// English, Telugu, or Hindi, so the API never returns user-facing prose.

const emptyToUndefined = (v) => (v === "" ? undefined : v);

function requiredString(code) {
  return z.string({ required_error: code, invalid_type_error: code });
}

const byteLengthAtMost = (max) => (s) => Buffer.byteLength(s, "utf8") <= max;

const signupBody = z
  .object({
    name: requiredString("NAME_REQUIRED")
      .trim()
      .min(2, "NAME_TOO_SHORT")
      .max(60, "NAME_TOO_LONG"),
    email: requiredString("EMAIL_REQUIRED")
      .trim()
      .toLowerCase()
      .max(254, "EMAIL_TOO_LONG")
      .email("INVALID_EMAIL"),
    password: requiredString("PASSWORD_REQUIRED")
      .min(8, "PASSWORD_TOO_SHORT")
      .max(72, "PASSWORD_TOO_LONG")
      .regex(/[A-Za-z]/, "PASSWORD_NEEDS_LETTER")
      .regex(/\d/, "PASSWORD_NEEDS_NUMBER")
      .refine(byteLengthAtMost(72), "PASSWORD_TOO_LONG"),
  })
  .strict();

const loginBody = z
  .object({
    email: requiredString("EMAIL_REQUIRED")
      .trim()
      .toLowerCase()
      .max(254, "INVALID_EMAIL"),
    password: requiredString("PASSWORD_REQUIRED")
      .min(1, "PASSWORD_REQUIRED")
      .max(128, "INVALID_PASSWORD"),
  })
  .strict();

const reportBody = z
  .object({
    status: z.enum(["AVAILABLE", "UNAVAILABLE"], {
      errorMap: () => ({ message: "INVALID_STATUS" }),
    }),
  })
  .strict();

const idParams = z.object({
  id: z
    .string({ invalid_type_error: "INVALID_ID" })
    .regex(/^[a-f\d]{24}$/i, "INVALID_ID"),
});

function optionalText(max, code) {
  return z.preprocess(
    emptyToUndefined,
    z.string({ invalid_type_error: code }).trim().max(max, code).optional(),
  );
}

function optionalNumber(min, max, code) {
  return z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ invalid_type_error: code })
      .min(min, code)
      .max(max, code)
      .optional(),
  );
}

const atmQuery = z
  .object({
    q: optionalText(80, "INVALID_QUERY"),
    bank: optionalText(60, "INVALID_BANK"),
    pincode: z.preprocess(
      emptyToUndefined,
      z
        .string({ invalid_type_error: "INVALID_PINCODE" })
        .regex(/^\d{6}$/, "INVALID_PINCODE")
        .optional(),
    ),
    status: z.preprocess(
      emptyToUndefined,
      z
        .enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"], {
          errorMap: () => ({ message: "INVALID_STATUS" }),
        })
        .optional(),
    ),
    lat: optionalNumber(-90, 90, "INVALID_COORDINATES"),
    lng: optionalNumber(-180, 180, "INVALID_COORDINATES"),
    radius: optionalNumber(100, 50000, "INVALID_RADIUS"),
    limit: optionalNumber(1, 200, "INVALID_LIMIT"),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), {
    message: "LOCATION_INCOMPLETE",
    path: ["lat"],
  });

module.exports = { signupBody, loginBody, reportBody, idParams, atmQuery };
