import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns a 200 JSON response reporting ok status", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});
