import { headers } from "next/headers";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function listTenants() {
  return auth.api.listOrganizations({ headers: await headers() });
}
