import { AcquisitionError } from "../errors";

describe("AcquisitionError", () => {
  it("sets code, message, and name", () => {
    const error = new AcquisitionError("timeout", "took too long");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AcquisitionError");
    expect(error.code).toBe("timeout");
    expect(error.message).toBe("took too long");
  });
});
