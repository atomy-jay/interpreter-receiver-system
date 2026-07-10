import {
  errorResponse,
  getSupabase,
  HttpError,
  json,
  parseToken,
  requireMethod
} from "./_shared.mjs";

export default async (request) => {
  try {
    requireMethod(request, "GET");
    const url = new URL(request.url);
    const token = parseToken(url.searchParams.get("token"));

    if (!token) throw new HttpError(400, "Ticket token is required");

    const supabase = getSupabase();

    const { data: registration, error } = await supabase
      .from("registrations")
      .select(`
        id, public_token, member_no, full_name, language, status, created_at,
        events!inner(id, code, name, event_date, location, active)
      `)
      .eq("public_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!registration || !registration.events?.active) {
      throw new HttpError(404, "Ticket not found");
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select(`
        status, rented_at, returned_at,
        receivers!inner(receiver_no)
      `)
      .eq("registration_id", registration.id)
      .order("rented_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rentalError) throw rentalError;

    return json({
      ok: true,
      ticket: {
        token: registration.public_token,
        member_no: registration.member_no,
        full_name: registration.full_name,
        language: registration.language,
        registration_status: registration.status,
        event: registration.events,
        rental: rental ? {
          status: rental.status,
          receiver_no: rental.receivers.receiver_no,
          rented_at: rental.rented_at,
          returned_at: rental.returned_at
        } : null
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const config = { path: "/api/ticket" };
