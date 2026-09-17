import {
  ANALYSIS_STAGES,
  REASSURANCE_MAX_MS,
  REASSURANCE_MIN_MS,
  REASSURANCE_STAGES,
  STAGE_INTERVAL_MS,
  getDelayAfterStage,
  getStageLabel,
} from "@/lib/analysis-loading-stages";

describe("getStageLabel", () => {
  it("returns each ANALYSIS_STAGES label in order", () => {
    ANALYSIS_STAGES.forEach((label, index) => {
      expect(getStageLabel(index)).toBe(label);
    });
  });

  it("returns each REASSURANCE_STAGES label once ANALYSIS_STAGES is exhausted", () => {
    REASSURANCE_STAGES.forEach((label, offset) => {
      expect(getStageLabel(ANALYSIS_STAGES.length + offset)).toBe(label);
    });
  });

  it("loops back to the first reassurance label after cycling through them all", () => {
    const firstReassuranceIndex = ANALYSIS_STAGES.length;
    const oneFullCycleLater = firstReassuranceIndex + REASSURANCE_STAGES.length;

    expect(getStageLabel(oneFullCycleLater)).toBe(REASSURANCE_STAGES[0]);
    expect(getStageLabel(oneFullCycleLater + 1)).toBe(REASSURANCE_STAGES[1]);
  });
});

describe("getDelayAfterStage", () => {
  it("uses STAGE_INTERVAL_MS while stages before the last ANALYSIS_STAGES entry remain", () => {
    for (let index = 0; index < ANALYSIS_STAGES.length - 1; index += 1) {
      expect(getDelayAfterStage(index)).toBe(STAGE_INTERVAL_MS);
    }
  });

  it("returns REASSURANCE_MIN_MS at the low end of Math.random()", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);
    expect(getDelayAfterStage(ANALYSIS_STAGES.length - 1)).toBe(
      REASSURANCE_MIN_MS
    );
    randomSpy.mockRestore();
  });

  it("approaches REASSURANCE_MAX_MS at the high end of Math.random()", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.999999);
    const delay = getDelayAfterStage(ANALYSIS_STAGES.length - 1);
    expect(delay).toBeGreaterThan(REASSURANCE_MIN_MS);
    expect(delay).toBeLessThan(REASSURANCE_MAX_MS);
    randomSpy.mockRestore();
  });

  it("stays randomized (within bounds) for stage indices past ANALYSIS_STAGES", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);
    const delay = getDelayAfterStage(ANALYSIS_STAGES.length + 2);
    expect(delay).toBeGreaterThanOrEqual(REASSURANCE_MIN_MS);
    expect(delay).toBeLessThan(REASSURANCE_MAX_MS);
    randomSpy.mockRestore();
  });
});
