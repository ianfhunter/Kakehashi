export const REVIEW_VERTICAL_LAYOUT_SCALE_MIN = 0.55;
export const CHARACTER_WRAPPER_PADDING = 8;
export const CHARACTER_WRAPPER_DETAILS_MIN_HEIGHT = 96;
export const CHARACTER_WRAPPER_DETAILS_PADDING_BOTTOM = 10;
export const CONTEXT_HINT_BUTTON_ROW_HEIGHT = 44;
export const CONTEXT_HINT_CONTAINER_MARGIN_TOP = 16;
export const CONTEXT_HINT_CONTENT_MARGIN_TOP = 12;
export const REVIEW_METADATA_STACK_MARGIN_BOTTOM = 10;
export const REVIEW_METADATA_STACK_GAP = 8;
export const REVIEW_METADATA_STACK_HEIGHT_ESTIMATE = 32;
export const REVIEW_ANSWER_AREA_HEIGHT_ESTIMATE = 128;
export const CONTEXT_HINT_PROMPT_SIZE_CAP = 96;

export function scaleReviewVerticalSpacing(
  value: number,
  scale: number,
  min = 0,
): number {
  return Math.max(min, Math.round(value * scale));
}

export function computeReviewVerticalLayoutScale({
  androidKeyboardHeight,
  androidQuestionLayoutHeight,
  baselineQuestionHeight,
  baseContextHintPanelHeight,
  isContextHintVisible,
  reviewPromptCharacterSize,
  shouldShowContextHintControls,
  shouldShowPausedSubjectDetails,
  shouldShowReviewItemMetadataInLayout,
  windowHeight,
}: {
  androidKeyboardHeight: number;
  androidQuestionLayoutHeight: number;
  baselineQuestionHeight: number;
  baseContextHintPanelHeight: number;
  isContextHintVisible: boolean;
  reviewPromptCharacterSize: number;
  shouldShowContextHintControls: boolean;
  shouldShowPausedSubjectDetails: boolean;
  shouldShowReviewItemMetadataInLayout: boolean;
  windowHeight: number;
}): number {
  const keyboardVisible = androidKeyboardHeight > 0;
  let fixedVerticalOverhead = 0;

  if (isContextHintVisible) {
    fixedVerticalOverhead += CHARACTER_WRAPPER_PADDING * 2;
    if (shouldShowContextHintControls) {
      fixedVerticalOverhead += CONTEXT_HINT_BUTTON_ROW_HEIGHT;
    }
    fixedVerticalOverhead +=
      baseContextHintPanelHeight +
      CONTEXT_HINT_CONTAINER_MARGIN_TOP +
      CONTEXT_HINT_CONTENT_MARGIN_TOP;
  }

  if (shouldShowPausedSubjectDetails) {
    fixedVerticalOverhead +=
      CHARACTER_WRAPPER_DETAILS_MIN_HEIGHT +
      CHARACTER_WRAPPER_DETAILS_PADDING_BOTTOM;
  }

  if (shouldShowReviewItemMetadataInLayout) {
    fixedVerticalOverhead +=
      REVIEW_METADATA_STACK_MARGIN_BOTTOM + REVIEW_METADATA_STACK_HEIGHT_ESTIMATE;
  }

  const questionAreaHeight =
    androidQuestionLayoutHeight > 0
      ? androidQuestionLayoutHeight
      : baselineQuestionHeight > 0
        ? baselineQuestionHeight
        : Math.round(windowHeight * (keyboardVisible ? 0.42 : 0.52));

  const availableForCharacter =
    questionAreaHeight - fixedVerticalOverhead - REVIEW_ANSWER_AREA_HEIGHT_ESTIMATE;
  const desiredCharacterHeight = reviewPromptCharacterSize * 1.1;

  if (availableForCharacter >= desiredCharacterHeight) {
    return 1;
  }

  return Math.max(
    REVIEW_VERTICAL_LAYOUT_SCALE_MIN,
    availableForCharacter / desiredCharacterHeight,
  );
}
