import "server-only";
import { cookies } from "next/headers";
import { GraphQLClient, type RequestDocument, type Variables } from "graphql-request";
import { getServerGraphQLTarget } from "./getBaseUrl";

/** Construct request-local headers; never cache a user's session in the public client. */
export async function requestSalon<T, V extends Variables = Variables>(document: RequestDocument, variables?: V): Promise<T> {
  const token = (await cookies()).get("keystonejs-session")?.value;
  const { endpoint, fetch: internalFetch } = await getServerGraphQLTarget();
  const client = new GraphQLClient(endpoint, { headers: token ? { Cookie: `keystonejs-session=${token}` } : {}, fetch: (url: RequestInfo | URL, init?: RequestInit) => (internalFetch ?? fetch)(url, { ...init, cache: "no-store" }) });
  return client.request<T>(document, variables);
}
