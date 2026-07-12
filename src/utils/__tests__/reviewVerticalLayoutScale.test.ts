import { computeReviewVerticalLayoutScale } from "../reviewVerticalLayoutScale";

describe("review vertical layout scale", () => {
  const baseInput = {
    androidKeyboardHeight: 0,
    androidQuestionLayoutHeight: 520,
    baselineQuestionHeight: 520,
    baseContextHintPanelHeight: 108,
    isContextHintVisible: false,
    reviewPromptCharacterSize: 96,
    shouldShowContextHintControls: false,
    shouldShowPausedSubjectDetails: false,
    shouldShowReviewItemMetadataInLayout: false,
    windowHeight: 800,
  };

  it("keeps full scale when there is enough vertical room", () => {
    expect(computeReviewVerticalLayoutScale(baseInput)).toBe(1);
  });

  it("scales character and spacing together when the keyboard compresses the pane", () => {
    const scale = computeReviewVerticalLayoutScale({
      ...baseInput,
      androidKeyboardHeight: 320,
      androidQuestionLayoutHeight: 200,
    });

    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThanOrEqual(0.55);
  });

  it("accounts for context hint overhead when hints are visible", () => {
    const withoutHint = computeReviewVerticalLayoutScale({
      ...baseInput,
      androidQuestionLayoutHeight: 360,
    });
    const withHint = computeReviewVerticalLayoutScale({
      ...baseInput,
      androidQuestionLayoutHeight: 360,
      isContextHintVisible: true,
      shouldShowContextHintControls: true,
    });

    expect(withHint).toBeLessThan(withoutHint);
  });
});
