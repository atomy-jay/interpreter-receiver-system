import { errorResponse, json, requireMethod, requireStaff } from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "POST");
    requireStaff(request);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/staff-auth" };
