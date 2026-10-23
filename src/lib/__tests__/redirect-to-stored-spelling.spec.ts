import { findRepoIgnoringCase } from "@/db/repos";
import { permanentRedirect } from "next/navigation";
import { redirectToStoredSpelling } from "../redirect-to-stored-spelling";

jest.mock("@/db/repos");
jest.mock("next/navigation");

const mockFindRepoIgnoringCase = findRepoIgnoringCase as jest.MockedFunction<
  typeof findRepoIgnoringCase
>;
const mockPermanentRedirect = permanentRedirect as jest.MockedFunction<
  typeof permanentRedirect
>;

const stored = {
  id: 72,
  owner: "nielse63",
  name: "RepoLore",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("redirectToStoredSpelling", () => {
  it("permanently redirects a case-variant spelling to the stored one (issue #43)", async () => {
    mockFindRepoIgnoringCase.mockResolvedValue(stored);

    await redirectToStoredSpelling("NIELSE63", "repolore");

    expect(mockFindRepoIgnoringCase).toHaveBeenCalledWith(
      "NIELSE63",
      "repolore"
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      "/lore/nielse63/RepoLore"
    );
  });

  it("keeps the subpage on the redirect target", async () => {
    mockFindRepoIgnoringCase.mockResolvedValue(stored);

    await redirectToStoredSpelling("nielse63", "repolore", "/systems/src");

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      "/lore/nielse63/RepoLore/systems/src"
    );
  });

  it("does not redirect when the stored spelling is exactly the requested one, so it can't loop", async () => {
    mockFindRepoIgnoringCase.mockResolvedValue(stored);

    await redirectToStoredSpelling("nielse63", "RepoLore");

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("does not redirect when no spelling of the repository is stored", async () => {
    mockFindRepoIgnoringCase.mockResolvedValue(null);

    await redirectToStoredSpelling("acme", "never-analyzed");

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });
});
