import type { SimulationInput } from "./types";

/** 시뮬레이션 입력을 URL-safe 문자열로 인코딩(공유 링크용). */
export function encodeShareState(input: Pick<SimulationInput, "land" | "cropId" | "cultivationType" | "salesChannel" | "targetYear">): string {
  const json = JSON.stringify(input);
  if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64url");
  // 브라우저
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShareState(token: string): Partial<SimulationInput> | null {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") json = Buffer.from(token, "base64url").toString("utf8");
    else {
      const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
      json = decodeURIComponent(escape(atob(b64)));
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}
