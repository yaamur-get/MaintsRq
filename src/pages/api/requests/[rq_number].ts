import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

type ResponseData = {
  mosque_name?: string;
  applicant_name?: string;
  phone?: string;
  district?: string;
  city?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { rq_number } = req.query;

  // Validate rq_number parameter
  if (!rq_number || typeof rq_number !== "string") {
    res.status(400).json({ error: "rq_number is required" });
    return;
  }

  try {
    // Create Supabase client with service_role for backend operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      res.status(500).json({ error: "Server configuration error" });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch request data with related tables using join
    const { data, error } = await supabase
      .from("requests")
      .select(
        `
        beneficiary_name,
        beneficiary_phone,
        mosques (
          name,
          districts (
            name,
            cities (
              name
            )
          )
        )
      `
      )
      .eq("rq_number", rq_number)
      .single();

    if (error || !data) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Transform the response to match the expected format
    // Handle the data structure which may have arrays due to the relationships
    const anyData = data as any;
    const mosque = Array.isArray(anyData.mosques) ? anyData.mosques[0] : anyData.mosques;
    const district = mosque && Array.isArray(mosque.districts) ? mosque.districts[0] : mosque?.districts;
    const city = district && Array.isArray(district.cities) ? district.cities[0] : district?.cities;

    const response: ResponseData = {
      mosque_name: mosque?.name || undefined,
      applicant_name: anyData.beneficiary_name || undefined,
      phone: anyData.beneficiary_phone || undefined,
      district: district?.name || undefined,
      city: city?.name || undefined,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
