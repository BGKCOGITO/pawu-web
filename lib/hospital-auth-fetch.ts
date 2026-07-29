import { supabase } from "@/lib/supabase";

export async function hospitalAuthFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("로그인이 필요합니다.");
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
