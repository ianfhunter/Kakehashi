import {
  Ionicons,
  FontAwesome,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputKeyPressEventData,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GitHubMark from "../../src/components/GitHubMark";
import OpenSourceModal from "../../src/components/OpenSourceModal";
import SrsProgressionSettingIcon from "../../src/components/SrsProgressionSettingIcon";
import { LevelRecapIcon } from "../../src/components/wrapped/LevelRecapIcon";
import { useSession } from "../../src/contexts/AuthContext";
import { getCurrentPatchNotesVersion } from "../../src/data/patchNotes";
import { rateAppService } from "../../src/services/rateAppService";
import { bunproSurveyService } from "../../src/services/bunproSurveyService";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import KeyboardManager, {
  JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
} from "../../src/modules/KeyboardManager";
import ReviewNotificationManager, {
  type PendingNotificationsResult,
} from "../../src/modules/ReviewNotificationManager";
import { useAppleMusicAuthCompat } from "../../src/hooks/useAppleMusicAuthCompat";
import {
  clearOfflineVocabularyAudioCache,
  getOfflineVocabularyAudioCacheStats,
  getOfflineVocabularyAudioProgress,
  queueOfflineVocabularyAudioDownloads,
  subscribeOfflineVocabularyAudioProgress,
  type OfflineVocabularyAudioProgress,
} from "../../src/services/offlineVocabularyAudioService";
import {
  clearInMemoryCache,
  fetchAllPages,
  getSubjects,
} from "../../src/utils/api";
import { apiDebugger } from "../../src/utils/apiDebugger";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import {
  azureSpeechService,
  JAPANESE_VOICES,
} from "../../src/utils/azureSpeech";
import {
  clearBadgeCount,
  updateBadgeWithReviewCount,
} from "../../src/utils/badgeNotifications";
import {
  checkSubjectsCacheHealth,
  clearCache,
  repairSubjectsCache,
  type CacheHealthStatus
} from "../../src/utils/cache";
import {
  analyzeCacheStorage,
  analyzeSubjectsCache,
  clearLargeCache,
  type CacheAnalysisResult,
} from "../../src/utils/cacheAnalyzer";
import { quickOptimize } from "../../src/utils/cacheOptimizer";
import { hasFeatureAccess } from "../../src/utils/featureFlags";
import {
  requestNotificationPermissions,
  updateBadgeAndScheduleNotifications,
} from "../../src/utils/reviewNotificationIntegration";
import {
  cancelReviewNotifications,
  initializeReviewNotifications,
  scheduleReviewChecks,
  syncDailyReminderNotifications,
} from "../../src/utils/reviewNotifications";
import {
  getReviewOrderLabel,
  DEFAULT_MAX_QUESTION_GAP,
} from "../../src/utils/reviewOrdering";
import { getLessonOrderLabel } from "../../src/utils/lessonOrdering";
import { isIOSOnMac } from "../../src/utils/platformSupport";
import {
  clearJpdbApiKey,
  getStoredJpdbApiKey,
  saveJpdbApiKey,
  validateJpdbApiKey,
} from "../../src/utils/jpdbApi";
import {
  buildLevelAnalyticsExportRows,
  buildLevelAnalyticsDetailedExportRows,
  getAvailableLevelAnalyticsLevels,
  type LevelAnalyticsExportRow,
  type LevelAnalyticsDetailedExportRow,
  serializeLevelAnalyticsExportRows,
  serializeLevelAnalyticsDetailedExportRows,
} from "../../src/utils/levelAnalyticsExport";
import {
  REVIEW_CHARACTER_FONT_SCALE_MAX,
  REVIEW_CHARACTER_FONT_SCALE_MIN,
  REVIEW_CHARACTER_FONT_SCALE_STEP,
  type SrsProgressionCardDisplayMode,
  type StudyModePreference,
  type VocabularyAudioVoicePreference,
  useAuthStore,
  useSettingsStore,
} from "../../src/utils/store";
import {
  formatReviewShortcutLabel,
  normalizeReviewShortcutKey,
  resolveReviewCorrectKeyboardShortcuts,
  resolveReviewIncorrectKeyboardShortcuts,
  sanitizeReviewShortcutInput,
  type ReviewCorrectKeyboardShortcutSettings,
  type ReviewIncorrectKeyboardShortcutSettings,
} from "../../src/utils/reviewKeyboardShortcuts";
import { useTheme } from "../../src/utils/theme";
// Dev only imports
let PerformanceDashboard: any = null;
if (__DEV__) {
  PerformanceDashboard =
    require("../../src/components/PerformanceDashboard").default;
}

const VOCABULARY_AUDIO_VOICE_OPTIONS: {
  value: VocabularyAudioVoicePreference;
  label: string;
  systemImage: string;
}[] = [
  { value: "female", label: "Kyoko (Female)", systemImage: "person.fill" },
  { value: "male", label: "Kenichi (Male)", systemImage: "person.fill" },
  { value: "random", label: "Random", systemImage: "shuffle" },
  { value: "both", label: "Both", systemImage: "person.2.fill" },
];

const VOCABULARY_AUDIO_VOICE_LABELS: Record<
  VocabularyAudioVoicePreference,
  string
> = {
  female: "Kyoko",
  male: "Kenichi",
  random: "Random",
  both: "Both",
};

const STUDY_MODE_DEFAULT_OPTIONS: {
  value: StudyModePreference;
  label: string;
}[] = [
  { value: "none", label: "Normal" },
  { value: "wk", label: "Vocab" },
  { value: "full", label: "Full" },
];

const SRS_PROGRESSION_CARD_MODE_OPTIONS: {
  value: SrsProgressionCardDisplayMode;
  label: string;
}[] = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
  { value: "hidden", label: "Hidden" },
];

const SRS_PROGRESSION_CARD_MODE_LABELS: Record<
  SrsProgressionCardDisplayMode,
  string
> = {
  normal: "Normal",
  compact: "Compact",
  hidden: "Hidden",
};

function formatByteSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return "...";
  }
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "...";
  }
  return Math.floor(value).toLocaleString();
}

function formatReviewCharacterFontScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

const REVIEW_INCORRECT_SHORTCUT_FIELDS: {
  key: keyof ReviewIncorrectKeyboardShortcutSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: "markIncorrect",
    label: "Mark Incorrect",
    hint: "Progress while keeping the answer incorrect.",
  },
  {
    key: "markCorrect",
    label: "Mark Correct",
    hint: "Override wrong answer as correct.",
  },
  {
    key: "askAgain",
    label: "Skip",
    hint: "Skip and requeue without marking incorrect.",
  },
  {
    key: "addSynonym",
    label: "Add as Synonym",
    hint: "Meaning questions only.",
  },
  {
    key: "openDetails",
    label: "Open Details",
    hint: "Open the current subject details page.",
  },
  {
    key: "replayAudio",
    label: "Replay Audio",
    hint: "Replay vocabulary pronunciation audio.",
  },
];

const REVIEW_CORRECT_SHORTCUT_FIELDS: {
  key: keyof ReviewCorrectKeyboardShortcutSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: "advanceOnCorrect",
    label: "Advance",
    hint: "Continue after a correct answer pause.",
  },
  {
    key: "replayAudio",
    label: "Replay Audio",
    hint: "Replay vocabulary pronunciation audio.",
  },
];

const PATREON_URL = "https://www.patreon.com/15731284/join";
const JPDB_SETTINGS_URL = "https://jpdb.io/settings";
const STOP_DETAILS_PREVIEW_IMAGE = require(
  "../../assets/images/StopDetails.png",
);
const STOP_DETAILS_PREVIEW_ASPECT_RATIO = 1320 / 2868;

type ReviewShortcutCaptureTarget =
  | {
      group: "incorrect";
      key: keyof ReviewIncorrectKeyboardShortcutSettings;
    }
  | {
      group: "correct";
      key: keyof ReviewCorrectKeyboardShortcutSettings;
    };

type LevelAnalyticsExportFormat = "summary" | "detailed";

type SettingsSectionKey =
  | "support"
  | "voice"
  | "vocabContext"
  | "readingDefaults"
  | "musicPlayback"
  | "lessons"
  | "subjectLists"
  | "reviews"
  | "haptic"
  | "kanji"
  | "profile"
  | "appearance"
  | "theme"
  | "widgets"
  | "notifications"
  | "dataStorage"
  | "levelRecap"
  | "patreon"
  | "account"
  | "apiDebug";

type SettingsSectionChip = {
  key: SettingsSectionKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

type SettingsSectionChipLayout = {
  x: number;
  width: number;
};

const SCROLL_TO_SECTION_KEY_MAP: Record<string, SettingsSectionKey> = {
  profile: "profile",
  reviews: "reviews",
  kanji: "kanji",
  lessons: "lessons",
  vocabContext: "vocabContext",
  subjectLists: "subjectLists",
  levelRecap: "levelRecap",
  jpdbApiKey: "profile",
  jpdb: "profile",
};

function resolveSectionKeyFromScrollParam(
  scrollToParam: string | undefined,
): SettingsSectionKey | null {
  if (!scrollToParam) {
    return null;
  }

  return SCROLL_TO_SECTION_KEY_MAP[scrollToParam] ?? null;
}

function normalizeToSteppedRange(
  rawValue: number,
  min: number,
  max: number,
  step: number,
): number {
  const boundedValue = Math.min(max, Math.max(min, Math.floor(rawValue)));
  const roundedToStep = Math.round(boundedValue / step) * step;
  return Math.min(max, Math.max(min, roundedToStep));
}

export default function Settings() {
  const { signOut } = useSession();
  const { logout } = useAuthStore();
  const { dashboardData } = useDashboardData();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const isRunningOnMacFromIOS = isIOSOnMac();
  const insets = useSafeAreaInsets();
  const sheetHorizontalPadding = 12;
  const sheetBottomPadding = 12;
  const answerStopPreviewImageHeight = Math.min(
    540,
    Math.max(360, windowHeight * 0.55),
  );
  const reviewShortcutSheetTopPadding = Math.max(insets.top + 8, 12);
  const modalHeaderPaddingTop = 24 + (Platform.OS === "android" ? insets.top : 0);
  const settingsBottomPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 16) : 16;
  const {
    lessonBatchSize,
    setLessonBatchSize,
    dailyLessonLimit,
    setDailyLessonLimit,
    lessonPickerViewMode,
    setLessonPickerViewMode,
    singlePageLessonView,
    setSinglePageLessonView,
    skipCustomLessonQuiz,
    setSkipCustomLessonQuiz,
    excludeKanaVocabularyFromLessons,
    setExcludeKanaVocabularyFromLessons,
    reviewBatchSizeEnabled,
    setReviewBatchSizeEnabled,
    reviewBatchSize,
    setReviewBatchSize,
    reviewWrapUpTargetSubjects,
    setReviewWrapUpTargetSubjects,
    reviewSearchButtonEnabled,
    setReviewSearchButtonEnabled,
    reviewCharacterFontScale,
    setReviewCharacterFontScale,
    allowSkippingReviews,
    setAllowSkippingReviews,
    showBadgeNotifications,
    setShowBadgeNotifications,
    enableReviewNotifications,
    setEnableReviewNotifications,
    dailyReviewReminderEnabled,
    setDailyReviewReminderEnabled,
    dailyReviewReminderHour,
    setDailyReviewReminderHour,
    dailyReviewReminderMinute,
    setDailyReviewReminderMinute,
    dailyLessonReminderEnabled,
    setDailyLessonReminderEnabled,
    dailyLessonReminderMinimum,
    setDailyLessonReminderMinimum,
    ankiCardMode,
    setAnkiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    ankiButtonlessMode,
    setAnkiButtonlessMode,
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    setAnkiShowOtherAcceptedAnswersAndUserSynonyms,
    reviewOrder,
    reviewTypeOrderEnabled,
    lessonOrder,
    lessonTypeOrderEnabled,
    interleaveLessonTypesEnabled,
    prioritizeCriticalItems,
    setPrioritizeCriticalItems,
    autoplayVocabularyAudio,
    setAutoplayVocabularyAudio,
    autoplayLessonReadingAudio,
    setAutoplayLessonReadingAudio,
    vocabularyAudioVoice,
    setVocabularyAudioVoice,
    offlineVocabularyAudioEnabled,
    setOfflineVocabularyAudioEnabled,
    showPitchAccent,
    setShowPitchAccent,
    showPatternsOfUse,
    setShowPatternsOfUse,
    showSimilarVocabulary,
    setShowSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    setShowSingleKanjiVocabularySimilarKanji,
    showMediaContextSentences,
    setShowMediaContextSentences,
    hideContextSentenceTranslations,
    setHideContextSentenceTranslations,
    showContextSentenceSpeedControl,
    setShowContextSentenceSpeedControl,
    showMnemonicIllustrations,
    setShowMnemonicIllustrations,
    myAnimeListUsername,
    setMyAnimeListUsername,
    gravatarEmail,
    setGravatarEmail,
    jitaiEnabled,
    setJitaiEnabled,
    jitaiSelectedFontIds,
    showStrokeOrder,
    setShowStrokeOrder,
    disableAutoProgressOnWrong,
    setDisableAutoProgressOnWrong,
    disableAutoProgressOnCloseAnswer,
    setDisableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    setDisableAutoProgressOnCorrect,
    acceptUserSynonymsAsAnswers,
    setAcceptUserSynonymsAsAnswers,
    showAddSynonymButton,
    setShowAddSynonymButton,
    acceptAnyKanjiOnyomiReading,
    setAcceptAnyKanjiOnyomiReading,
    showOnyomiInKatakana,
    setShowOnyomiInKatakana,
    backToBackQuestions,
    setBackToBackQuestions,
    backToBackImmediateRetryIncorrect,
    setBackToBackImmediateRetryIncorrect,
    autoSwitchKeyboard,
    setAutoSwitchKeyboard,
    voiceReviewAnswersEnabled,
    setVoiceReviewAnswersEnabled,
    hapticFeedbackEnabled,
    setHapticFeedbackEnabled,
    reviewIncorrectKeyboardShortcuts,
    setReviewIncorrectKeyboardShortcuts,
    reviewCorrectKeyboardShortcuts,
    setReviewCorrectKeyboardShortcuts,
    showAnswerStopSubjectDetails,
    setShowAnswerStopSubjectDetails,
    showReviewItemLevelAndSrsStage,
    setShowReviewItemLevelAndSrsStage,
    reviewAnimatePreviousQuestion,
    setReviewAnimatePreviousQuestion,
    srsProgressionCardDisplayMode,
    setSrsProgressionCardDisplayMode,
    strokeLeniency,
    setStrokeLeniency,
    visuallySimilarKanjiSource,
    setVisuallySimilarKanjiSource,
    newsDefaultStudyMode,
    setNewsDefaultStudyMode,
    songsPlaybackSource,
    setSongsPlaybackSource,
    songsLyricsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
    appleMusicAuthStatus,
    setAppleMusicAuthStatus,
    lastSeenPatchNotesVersion,
    bunproSurveyCompleted,
    setBunproSurveyCompleted,
  } = useSettingsStore();
  const {
    available: isAppleMusicAuthAvailable,
    requestAuthorization: requestAppleMusicAuthorization,
    checkSubscription: checkAppleMusicSubscription,
    isAuthenticating: isAppleMusicAuthenticating,
    error: appleMusicAuthError,
  } = useAppleMusicAuthCompat();
  const [selectedVoice, setSelectedVoice] =
    useState<string>("ja-JP-NanamiNeural");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showOpenSourceModal, setShowOpenSourceModal] = useState(false);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [cacheAnalysis, setCacheAnalysis] =
    useState<CacheAnalysisResult | null>(null);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [isAnalyzingCache, setIsAnalyzingCache] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] =
    useState(false); // Dev only state
  const [pendingNotifications, setPendingNotifications] =
    useState<PendingNotificationsResult | null>(null);
  const [expoPendingNotifications, setExpoPendingNotifications] = useState<
    Notifications.NotificationRequest[]
  >([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showVocabularyVoiceMenu, setShowVocabularyVoiceMenu] = useState(false);
  const [showSrsProgressionCardModeMenu, setShowSrsProgressionCardModeMenu] =
    useState(false);
  const [showReminderTimeModal, setShowReminderTimeModal] = useState(false);
  const [showReviewShortcutModal, setShowReviewShortcutModal] = useState(false);
  const [
    showAnswerStopDetailsPreview,
    setShowAnswerStopDetailsPreview,
  ] = useState(false);
  const [showBunproSurveyModal, setShowBunproSurveyModal] = useState(false);
  const [offlineAudioProgress, setOfflineAudioProgress] =
    useState<OfflineVocabularyAudioProgress>(() =>
      getOfflineVocabularyAudioProgress(),
    );
  const [offlineAudioCacheSizeBytes, setOfflineAudioCacheSizeBytes] = useState<
    number | null
  >(null);
  const [offlineAudioCacheFileCount, setOfflineAudioCacheFileCount] = useState<
    number | null
  >(null);
  const [isClearingOfflineAudioCache, setIsClearingOfflineAudioCache] =
    useState(false);
  const [reviewIncorrectShortcutDraft, setReviewIncorrectShortcutDraft] =
    useState<ReviewIncorrectKeyboardShortcutSettings>(
      resolveReviewIncorrectKeyboardShortcuts(reviewIncorrectKeyboardShortcuts),
    );
  const [reviewCorrectShortcutDraft, setReviewCorrectShortcutDraft] =
    useState<ReviewCorrectKeyboardShortcutSettings>(
      resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
    );
  const [capturingReviewShortcutKey, setCapturingReviewShortcutKey] = useState<
    ReviewShortcutCaptureTarget | null
  >(null);
  const reviewShortcutCaptureInputRef = useRef<TextInput>(null);
  const offlineCacheRefreshInFlightRef = useRef(false);
  const previousOfflineAudioInProgressRef = useRef(
    getOfflineVocabularyAudioProgress().inProgress,
  );
  const [reminderHourDraft, setReminderHourDraft] = useState(
    dailyReviewReminderHour,
  );
  const [reminderMinuteDraft, setReminderMinuteDraft] = useState(
    dailyReviewReminderMinute,
  );
  const [cacheHealthStatus, setCacheHealthStatus] =
    useState<CacheHealthStatus | null>(null);
  const [isCheckingCacheHealth, setIsCheckingCacheHealth] = useState(false);
  const [isRepairingCache, setIsRepairingCache] = useState(false);
  const [isExportingLevelAnalytics, setIsExportingLevelAnalytics] =
    useState(false);
  const [showLevelAnalyticsExportModal, setShowLevelAnalyticsExportModal] =
    useState(false);
  const [levelAnalyticsExportFormat, setLevelAnalyticsExportFormat] =
    useState<LevelAnalyticsExportFormat>("detailed");
  const [selectedLevelAnalyticsLevels, setSelectedLevelAnalyticsLevels] =
    useState<number[]>([]);
  const { apiToken, userData } = useAuthStore();

  const [gravatarEmailInput, setGravatarEmailInput] = useState<string>(
    gravatarEmail ?? "",
  );
  const [jpdbApiKeyInput, setJpdbApiKeyInput] = useState<string>("");
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [isLoadingJpdbApiKey, setIsLoadingJpdbApiKey] = useState(true);
  const [isSavingJpdbApiKey, setIsSavingJpdbApiKey] = useState(false);
  const [jpdbApiKeyStatus, setJpdbApiKeyStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [bunproUsageAnswer, setBunproUsageAnswer] = useState<"yes" | "no" | null>(null);
  const [bunproIntegrationAnswer, setBunproIntegrationAnswer] = useState<
    "yes" | "no" | null
  >(null);
  const [bunproFeatureRequestInput, setBunproFeatureRequestInput] = useState("");
  const [isSubmittingBunproSurvey, setIsSubmittingBunproSurvey] = useState(false);
  const normalizedEmail = gravatarEmail?.trim().toLowerCase() ?? "";
  const isSongsHiddenForEmail = normalizedEmail === "kakehashi.app@gmail.com";
  const isPortegoUser = isPortegoUsername(userData?.username);
  const showBunproSurvey = !bunproSurveyCompleted;
  const canAccessApiDebugTools = __DEV__ || isPortegoUser;
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionChipScrollViewRef = useRef<ScrollView>(null);
  const showMusicPlaybackSection =
    !isSongsHiddenForEmail && Platform.OS === "ios";
  const showWidgetsSection = Platform.OS === "ios";
  const showDataStorageSection = hasFeatureAccess(
    "cache_management",
    gravatarEmail,
  );
  const showLevelRecapSection = dashboardData.currentLevel > 0;
  const params = useLocalSearchParams();
  const scrollToParam = Array.isArray(params.scrollTo)
    ? params.scrollTo[0]
    : params.scrollTo;
  const [selectedSectionKey, setSelectedSectionKey] = useState<
    SettingsSectionKey
  >(() => resolveSectionKeyFromScrollParam(scrollToParam) ?? "support");
  const [sectionChipBarWidth, setSectionChipBarWidth] = useState(0);
  const [sectionChipLayouts, setSectionChipLayouts] = useState<
    Partial<Record<SettingsSectionKey, SettingsSectionChipLayout>>
  >({});
  const [sectionOffsets, setSectionOffsets] = useState<
    Partial<Record<SettingsSectionKey, number>>
  >({});
  const [pendingSectionScrollRequest, setPendingSectionScrollRequest] =
    useState<{ key: SettingsSectionKey; animated: boolean } | null>(() => {
      const sectionKey = resolveSectionKeyFromScrollParam(scrollToParam);
      if (!sectionKey) {
        return null;
      }

      return { key: sectionKey, animated: false };
    });
  const sectionChips = useMemo<SettingsSectionChip[]>(() => {
    const chips: SettingsSectionChip[] = [
      { key: "support", label: "Support", icon: "heart-outline" },
      { key: "voice", label: "Voice", icon: "volume-high-outline" },
      { key: "vocabContext", label: "Vocab Context", icon: "book-outline" },
      { key: "readingDefaults", label: "Reading", icon: "newspaper-outline" },
    ];

    if (showMusicPlaybackSection) {
      chips.push({
        key: "musicPlayback",
        label: "Music",
        icon: "musical-notes-outline",
      });
    }

    chips.push(
      { key: "lessons", label: "Lessons", icon: "school-outline" },
      { key: "subjectLists", label: "Subject Lists", icon: "list-outline" },
      { key: "reviews", label: "Reviews", icon: "checkmark-done-outline" },
      { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
      { key: "kanji", label: "Kanji", icon: "brush-outline" },
      { key: "profile", label: "Profile", icon: "person-circle-outline" },
      { key: "appearance", label: "Appearance", icon: "color-palette-outline" },
      { key: "theme", label: "Theme", icon: "contrast-outline" },
    );

    if (showWidgetsSection) {
      chips.push({ key: "widgets", label: "Widgets", icon: "grid-outline" });
    }

    chips.push({
      key: "notifications",
      label: "Notifications",
      icon: "notifications-outline",
    });

    if (showDataStorageSection) {
      chips.push({ key: "dataStorage", label: "Data", icon: "server-outline" });
    }
    if (showLevelRecapSection) {
      chips.push({
        key: "levelRecap",
        label: "Level Recap",
        icon: "bar-chart-outline",
      });
    }

    chips.push(
      { key: "patreon", label: "Patreon", icon: "people-outline" },
      { key: "account", label: "Account", icon: "log-out-outline" },
    );

    if (canAccessApiDebugTools) {
      chips.push({ key: "apiDebug", label: "API Debug", icon: "bug-outline" });
    }

    return chips;
  }, [
    canAccessApiDebugTools,
    showDataStorageSection,
    showLevelRecapSection,
    showMusicPlaybackSection,
    showWidgetsSection,
  ]);
  const updateSectionOffset = useCallback(
    (sectionKey: SettingsSectionKey, sectionY: number) => {
      const normalizedY = Math.max(0, sectionY);
      setSectionOffsets((current) => {
        const previousY = current[sectionKey];
        if (
          typeof previousY === "number" &&
          Math.abs(previousY - normalizedY) < 1
        ) {
          return current;
        }
        return {
          ...current,
          [sectionKey]: normalizedY,
        };
      });
    },
    [],
  );
  const updateSectionChipLayout = useCallback(
    (sectionKey: SettingsSectionKey, x: number, width: number) => {
      setSectionChipLayouts((current) => {
        const previousLayout = current[sectionKey];
        if (
          previousLayout &&
          Math.abs(previousLayout.x - x) < 1 &&
          Math.abs(previousLayout.width - width) < 1
        ) {
          return current;
        }

        return {
          ...current,
          [sectionKey]: { x, width },
        };
      });
    },
    [],
  );
  const scrollToSection = useCallback(
    (sectionKey: SettingsSectionKey, animated: boolean) => {
      setSelectedSectionKey(sectionKey);
      const targetY = sectionOffsets[sectionKey];
      if (typeof targetY !== "number") {
        setPendingSectionScrollRequest({ key: sectionKey, animated });
        return;
      }

      setPendingSectionScrollRequest(null);
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 8), animated });
    },
    [sectionOffsets],
  );
  const handleSettingsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const visibleSections = sectionChips
        .map((chip) => {
          const offset = sectionOffsets[chip.key];
          if (typeof offset !== "number") {
            return null;
          }
          return {
            key: chip.key,
            offset,
          };
        })
        .filter(
          (
            section,
          ): section is { key: SettingsSectionKey; offset: number } =>
            section !== null,
        )
        .sort((a, b) => a.offset - b.offset);

      if (visibleSections.length === 0) {
        return;
      }

      const scrollY = Math.max(0, event.nativeEvent.contentOffset.y) + 24;
      let activeSectionKey = visibleSections[0].key;

      for (const section of visibleSections) {
        if (scrollY >= section.offset) {
          activeSectionKey = section.key;
        } else {
          break;
        }
      }

      setSelectedSectionKey((current) =>
        current === activeSectionKey ? current : activeSectionKey,
      );
    },
    [sectionChips, sectionOffsets],
  );
  const availableLevelAnalyticsLevels = useMemo(
    () =>
      getAvailableLevelAnalyticsLevels({
        subjects: dashboardData.subjects,
        assignments: dashboardData.assignments,
        levelProgressions: dashboardData.levelProgressions,
        resets: dashboardData.resets,
        currentLevel: dashboardData.currentLevel,
        username: userData?.username ?? "",
      }),
    [
      dashboardData.assignments,
      dashboardData.currentLevel,
      dashboardData.levelProgressions,
      dashboardData.resets,
      dashboardData.subjects,
      userData?.username,
    ],
  );

  useEffect(() => {
    apiDebugger.setDebugAccessByUsername(userData?.username);
  }, [userData?.username]);

  useEffect(() => {
    const requestedSectionKey = resolveSectionKeyFromScrollParam(scrollToParam);
    if (!requestedSectionKey) {
      return;
    }
    setSelectedSectionKey(requestedSectionKey);
    setPendingSectionScrollRequest({
      key: requestedSectionKey,
      animated: false,
    });
  }, [scrollToParam]);

  useEffect(() => {
    if (sectionChips.some((chip) => chip.key === selectedSectionKey)) {
      return;
    }

    const fallbackSectionKey = sectionChips[0]?.key;
    if (fallbackSectionKey) {
      setSelectedSectionKey(fallbackSectionKey);
    }
  }, [sectionChips, selectedSectionKey]);

  useEffect(() => {
    if (!pendingSectionScrollRequest) {
      return;
    }

    const targetY = sectionOffsets[pendingSectionScrollRequest.key];
    if (typeof targetY !== "number") {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, targetY - 8),
      animated: pendingSectionScrollRequest.animated,
    });
    setPendingSectionScrollRequest(null);
  }, [pendingSectionScrollRequest, sectionOffsets]);

  useEffect(() => {
    if (sectionChipBarWidth <= 0) {
      return;
    }

    const selectedChipLayout = sectionChipLayouts[selectedSectionKey];
    if (!selectedChipLayout) {
      return;
    }

    const chipLayouts = Object.values(sectionChipLayouts).filter(
      (layout): layout is SettingsSectionChipLayout => Boolean(layout),
    );
    if (chipLayouts.length === 0) {
      return;
    }

    const chipContentWidth = chipLayouts.reduce(
      (maxWidth, layout) => Math.max(maxWidth, layout.x + layout.width),
      0,
    );
    const centeredX =
      selectedChipLayout.x + selectedChipLayout.width / 2 - sectionChipBarWidth / 2;
    const maxScrollX = Math.max(0, chipContentWidth - sectionChipBarWidth);
    const targetX = Math.max(0, Math.min(centeredX, maxScrollX));

    sectionChipScrollViewRef.current?.scrollTo({ x: targetX, animated: true });
  }, [sectionChipBarWidth, sectionChipLayouts, selectedSectionKey]);

  useEffect(() => {
    if (availableLevelAnalyticsLevels.length === 0) {
      setSelectedLevelAnalyticsLevels([]);
      return;
    }

    setSelectedLevelAnalyticsLevels((current) => {
      if (current.length === 0) {
        return availableLevelAnalyticsLevels;
      }

      const allowed = new Set(availableLevelAnalyticsLevels);
      const filtered = current.filter((level) => allowed.has(level));
      if (filtered.length === 0) {
        return availableLevelAnalyticsLevels;
      }

      if (
        filtered.length === current.length &&
        filtered.every((value, index) => value === current[index])
      ) {
        return current;
      }

      return filtered;
    });
  }, [availableLevelAnalyticsLevels]);

  // Load current voice selection on component mount
  useEffect(() => {
    loadCurrentVoice();
  }, []);

  useEffect(() => {
    setGravatarEmailInput(gravatarEmail ?? "");
  }, [gravatarEmail]);

  useEffect(() => {
    let didCancel = false;

    const loadJpdbApiKey = async () => {
      setIsLoadingJpdbApiKey(true);
      try {
        const storedKey = await getStoredJpdbApiKey();
        if (didCancel) {
          return;
        }

        setJpdbApiKeyInput(storedKey ?? "");
        setHasStoredJpdbApiKey(Boolean(storedKey));
      } finally {
        if (!didCancel) {
          setIsLoadingJpdbApiKey(false);
        }
      }
    };

    void loadJpdbApiKey();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (isLoadingJpdbApiKey || hasStoredJpdbApiKey) {
      return;
    }

    if (newsDefaultStudyMode === "full") {
      setNewsDefaultStudyMode("none");
    }
    if (songsLyricsDefaultStudyMode === "full") {
      setSongsLyricsDefaultStudyMode("wk");
    }
  }, [
    hasStoredJpdbApiKey,
    isLoadingJpdbApiKey,
    newsDefaultStudyMode,
    songsLyricsDefaultStudyMode,
    setNewsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
  ]);

  useEffect(() => {
    if (!showReminderTimeModal) {
      setReminderHourDraft(dailyReviewReminderHour);
      setReminderMinuteDraft(dailyReviewReminderMinute);
    }
  }, [
    dailyReviewReminderHour,
    dailyReviewReminderMinute,
    showReminderTimeModal,
  ]);

  useEffect(() => {
    if (!showReviewShortcutModal) {
      setReviewIncorrectShortcutDraft(
        resolveReviewIncorrectKeyboardShortcuts(
          reviewIncorrectKeyboardShortcuts,
        ),
      );
      setReviewCorrectShortcutDraft(
        resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
      );
      setCapturingReviewShortcutKey(null);
    }
  }, [
    reviewIncorrectKeyboardShortcuts,
    reviewCorrectKeyboardShortcuts,
    showReviewShortcutModal,
  ]);

  useEffect(() => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    const focusTimer = setTimeout(() => {
      reviewShortcutCaptureInputRef.current?.focus();
    }, 0);

    return () => clearTimeout(focusTimer);
  }, [capturingReviewShortcutKey]);

  const refreshOfflineAudioCacheSize = useCallback(async () => {
    if (offlineCacheRefreshInFlightRef.current) {
      return;
    }

    offlineCacheRefreshInFlightRef.current = true;
    try {
      const cacheStats = await getOfflineVocabularyAudioCacheStats();
      setOfflineAudioCacheSizeBytes(cacheStats.totalBytes);
      setOfflineAudioCacheFileCount(cacheStats.fileCount);
    } catch {
      setOfflineAudioCacheSizeBytes(null);
      setOfflineAudioCacheFileCount(null);
    } finally {
      offlineCacheRefreshInFlightRef.current = false;
    }
  }, []);

  const triggerOfflineAudioDownload = async (options?: {
    forceReindex?: boolean;
    enabled?: boolean;
  }) => {
    try {
      await queueOfflineVocabularyAudioDownloads({
        enabled: options?.enabled ?? offlineVocabularyAudioEnabled,
        currentLevel: userData?.level ?? 1,
        voicePreference: "both",
        forceReindex: options?.forceReindex,
      });
    } catch {
      Alert.alert(
        "Offline Audio",
        "Failed to queue offline vocabulary audio downloads. Please try again."
      );
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeOfflineVocabularyAudioProgress((progress) => {
      setOfflineAudioProgress(progress);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      void refreshOfflineAudioCacheSize();
    });

    return () => {
      interaction.cancel();
    };
  }, [refreshOfflineAudioCacheSize]);

  useEffect(() => {
    const wasInProgress = previousOfflineAudioInProgressRef.current;
    const isInProgress = offlineAudioProgress.inProgress;
    previousOfflineAudioInProgressRef.current = isInProgress;

    if (wasInProgress && !isInProgress) {
      void refreshOfflineAudioCacheSize();
    }
  }, [offlineAudioProgress.inProgress, refreshOfflineAudioCacheSize]);

  const loadCurrentVoice = () => {
    const config = azureSpeechService.getConfig();
    setSelectedVoice(config.selectedVoice);
  };

  const handleVoiceSelection = () => {
    setShowVoiceModal(true);
  };

  const saveSelectedVoice = async (voiceShortName: string) => {
    try {
      await azureSpeechService.saveSelectedVoice(voiceShortName);
      setSelectedVoice(voiceShortName);
      setShowVoiceModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to save voice selection");
    }
  };

  const testVoice = async (voiceShortName: string) => {
    // Stop any currently playing voice test
    if (testingVoiceId !== null) {
      await azureSpeechService.stop();
    }

    setTestingVoiceId(voiceShortName);

    // Store the original voice only if we're not already testing
    const originalVoice = selectedVoice;
    await azureSpeechService.saveSelectedVoice(voiceShortName);

    // Test text saying in japanese "My name is (name)" removing ja-JP from the voiceShortName
    const testText = `私の名前は ${voiceShortName
      ?.replace("ja-JP-", "")
      ?.replace("Neural", "")} です`;

    try {
      await azureSpeechService.speak(
        testText,
        () => {},
        () => {
          // Only clear testing state if this voice is still the one being tested
          if (testingVoiceId === voiceShortName) {
            setTestingVoiceId(null);
            // Restore original voice if not selected
            if (originalVoice !== voiceShortName) {
              azureSpeechService.saveSelectedVoice(originalVoice);
            }
          }
        },
        (error) => {
          console.error("Voice test error:", error);
          // Only clear testing state if this voice is still the one being tested
          if (testingVoiceId === voiceShortName) {
            setTestingVoiceId(null);
            // Restore original voice on error
            azureSpeechService.saveSelectedVoice(originalVoice);
            Alert.alert(
              "Test Failed",
              "Unable to test voice. Please check your internet connection.",
            );
          }
        },
      );
    } catch (error) {
      // Only clear testing state if this voice is still the one being tested
      if (testingVoiceId === voiceShortName) {
        setTestingVoiceId(null);
        // Restore original voice on error
        await azureSpeechService.saveSelectedVoice(originalVoice);
        Alert.alert(
          "Test Failed",
          "Unable to test voice. Please check your internet connection.",
        );
      }
    }
  };

  const handleSaveGravatarEmail = () => {
    const email = gravatarEmailInput.trim();
    if (email === "") {
      setGravatarEmail(null);
      Alert.alert("Success", "Gravatar email removed.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setGravatarEmail(email);
    Alert.alert("Success", "Gravatar email updated.");
  };

  const handleSaveJpdbApiKey = async () => {
    const normalizedKey = jpdbApiKeyInput.trim();
    setJpdbApiKeyStatus(null);

    if (!normalizedKey) {
      await clearJpdbApiKey();
      setHasStoredJpdbApiKey(false);
      setJpdbApiKeyStatus({
        message: "JPDB API key removed.",
        isError: false,
      });
      return;
    }

    setIsSavingJpdbApiKey(true);
    setJpdbApiKeyStatus({
      message: "Validating JPDB API key...",
      isError: false,
    });

    try {
      const isValid = await validateJpdbApiKey(normalizedKey);
      if (!isValid) {
        setJpdbApiKeyStatus({
          message: "JPDB API key is invalid or JPDB is unavailable.",
          isError: true,
        });
        return;
      }

      await saveJpdbApiKey(normalizedKey);
      setJpdbApiKeyInput(normalizedKey);
      setHasStoredJpdbApiKey(true);
      setJpdbApiKeyStatus({
        message: "JPDB API key saved.",
        isError: false,
      });
    } catch (error) {
      console.error("Failed to save JPDB API key:", error);
      setJpdbApiKeyStatus({
        message: "Could not save JPDB API key right now.",
        isError: true,
      });
    } finally {
      setIsSavingJpdbApiKey(false);
    }
  };

  const handleRemoveJpdbApiKey = async () => {
    setIsSavingJpdbApiKey(true);
    try {
      await clearJpdbApiKey();
      setJpdbApiKeyInput("");
      setHasStoredJpdbApiKey(false);
      setJpdbApiKeyStatus({
        message: "JPDB API key removed.",
        isError: false,
      });
    } catch (error) {
      console.error("Failed to remove JPDB API key:", error);
      setJpdbApiKeyStatus({
        message: "Could not remove JPDB API key right now.",
        isError: true,
      });
    } finally {
      setIsSavingJpdbApiKey(false);
    }
  };

  const isDailyLessonLimitEnabled = dailyLessonLimit > 0;
  const dailyLessonLimitMin = 5;
  const dailyLessonLimitMax = 500;
  const dailyLessonLimitStep = Math.max(1, lessonBatchSize);
  const dailyLessonReminderMinimumMin = 5;
  const dailyLessonReminderMinimumMax = 100;
  const dailyLessonReminderMinimumStep = Math.max(1, lessonBatchSize);
  const getPreviousDailyLessonLimit = (currentLimit: number) => {
    const previousMultiple =
      Math.floor((currentLimit - 1) / dailyLessonLimitStep) *
      dailyLessonLimitStep;
    return Math.max(dailyLessonLimitMin, previousMultiple);
  };
  const getNextDailyLessonLimit = (currentLimit: number) => {
    const nextMultiple =
      (Math.floor(currentLimit / dailyLessonLimitStep) + 1) *
      dailyLessonLimitStep;
    return Math.min(dailyLessonLimitMax, nextMultiple);
  };
  const getPreviousDailyLessonReminderMinimum = (currentMinimum: number) => {
    const previousMultiple =
      Math.floor((currentMinimum - 1) / dailyLessonReminderMinimumStep) *
      dailyLessonReminderMinimumStep;
    return Math.max(dailyLessonReminderMinimumMin, previousMultiple);
  };
  const getNextDailyLessonReminderMinimum = (currentMinimum: number) => {
    const nextMultiple =
      (Math.floor(currentMinimum / dailyLessonReminderMinimumStep) + 1) *
      dailyLessonReminderMinimumStep;
    return Math.min(dailyLessonReminderMinimumMax, nextMultiple);
  };
  const isAnyDailyReminderEnabled =
    dailyReviewReminderEnabled || dailyLessonReminderEnabled;
  const reviewWrapUpTargetMin = 5;
  const reviewWrapUpTargetMax = 20;
  const reviewWrapUpTargetStep = 5;
  const effectiveReviewWrapUpQuestionGap = Math.min(
    reviewWrapUpTargetSubjects,
    DEFAULT_MAX_QUESTION_GAP,
  );
  const canDecreaseReviewCharacterFontScale =
    reviewCharacterFontScale > REVIEW_CHARACTER_FONT_SCALE_MIN;
  const canIncreaseReviewCharacterFontScale =
    reviewCharacterFontScale < REVIEW_CHARACTER_FONT_SCALE_MAX;

  const handleDailyLessonLimitToggle = (enabled: boolean) => {
    if (!enabled) {
      setDailyLessonLimit(0);
      return;
    }

    const baseLimit = dailyLessonLimit > 0 ? dailyLessonLimit : 30;
    const normalizedLimit = Math.min(
      dailyLessonLimitMax,
      Math.max(
        dailyLessonLimitMin,
        Math.round(baseLimit / dailyLessonLimitStep) * dailyLessonLimitStep
      )
    );
    setDailyLessonLimit(normalizedLimit);
  };

  const handleRateAppPress = async () => {
    // Log the rate app click
    if (apiToken) {
      rateAppService.logRateAppClick({
        userId: userData?.id ?? null,
        userEmail: gravatarEmail,
        userUsername: userData?.username,
        userLevel: userData?.level,
        source: "settings",
      });
    }

    const didOpenReviewFlow = await rateAppService.openRateAppFlow();
    if (!didOpenReviewFlow) {
      Alert.alert(
        "Unable to Open Store",
        "Could not open the app rating flow. Please try again later."
      );
    }
  };

  const handlePatreonPress = async () => {
    try {
      const canOpenPatreon = await Linking.canOpenURL(PATREON_URL);
      if (!canOpenPatreon) {
        Alert.alert(
          "Unable to Open Patreon",
          "Could not open Patreon right now. Please try again later.",
        );
        return;
      }

      await Linking.openURL(PATREON_URL);
    } catch (error) {
      console.error("Failed to open Patreon URL:", error);
      Alert.alert(
        "Unable to Open Patreon",
        "Could not open Patreon right now. Please try again later.",
      );
    }
  };

  const submitBunproSurveyResponse = useCallback(
    async (usesBunpro: boolean) => {
      if (isSubmittingBunproSurvey) {
        return false;
      }

      setIsSubmittingBunproSurvey(true);

      try {
        const wasLogged = await bunproSurveyService.logResponse({
          userId: userData?.id ?? null,
          userUsername: userData?.username ?? null,
          userLevel: userData?.level ?? null,
          usesBunpro,
          wantsBunproInApp: usesBunpro
            ? bunproIntegrationAnswer === "yes"
            : null,
          requestedFeatures: usesBunpro ? bunproFeatureRequestInput : null,
        });

        if (!wasLogged) {
          Alert.alert(
            "Couldn't Save Response",
            "Please try again in a moment."
          );
          return false;
        }

        setBunproSurveyCompleted(true);
        setShowBunproSurveyModal(false);
        setBunproUsageAnswer(null);
        setBunproIntegrationAnswer(null);
        setBunproFeatureRequestInput("");
        return true;
      } finally {
        setIsSubmittingBunproSurvey(false);
      }
    },
    [
      bunproFeatureRequestInput,
      bunproIntegrationAnswer,
      isSubmittingBunproSurvey,
      setBunproSurveyCompleted,
      userData?.id,
      userData?.level,
      userData?.username,
    ]
  );

  const handleBunproUsageSelection = useCallback(
    (selection: "yes" | "no") => {
      setBunproUsageAnswer(selection);
      if (selection === "yes") {
        return;
      }

      setBunproIntegrationAnswer(null);
      setBunproFeatureRequestInput("");
    },
    []
  );

  const handleSubmitBunproSurvey = useCallback(async () => {
    if (!bunproUsageAnswer) {
      Alert.alert("One More Thing", "Please answer whether you use Bunpro.");
      return;
    }

    if (bunproUsageAnswer === "yes" && !bunproIntegrationAnswer) {
      Alert.alert("One More Thing", "Please answer whether you want Bunpro in this app.");
      return;
    }

    await submitBunproSurveyResponse(bunproUsageAnswer === "yes");
  }, [bunproIntegrationAnswer, bunproUsageAnswer, submitBunproSurveyResponse]);

  const handleJpdbApiKeyInfoPress = () => {
    Alert.alert(
      "JPDB API Key",
      "This key enables parse-first vocabulary detection in News, the EPUB reader, and the URL Reader.\n\nYou can get it for free by creating a JPDB account, then opening jpdb.io/settings and copying your key from the \"Account information\" section.",
      [
        { text: "Close", style: "cancel" },
        {
          text: "Open JPDB Settings",
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(JPDB_SETTINGS_URL);
              if (!canOpen) {
                Alert.alert(
                  "Unable to Open JPDB",
                  "Could not open JPDB settings right now."
                );
                return;
              }
              await Linking.openURL(JPDB_SETTINGS_URL);
            } catch (error) {
              console.error("Failed to open JPDB settings URL:", error);
              Alert.alert(
                "Unable to Open JPDB",
                "Could not open JPDB settings right now."
              );
            }
          },
        },
      ]
    );
  };

  const handleBlockedFullModeSelection = useCallback(
    (context: "news" | "lyrics") => {
      const contextLabel =
        context === "news"
          ? "the NHK News default view"
          : "the Song Lyrics default view";

      Alert.alert(
        "JPDB API Key Required",
        `Full mode for ${contextLabel} is blocked until you save a JPDB API key.`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Go to JPDB API Key",
            onPress: () => {
              scrollToSection("profile", true);
            },
          },
        ]
      );
    },
    [scrollToSection]
  );

  const getAppleMusicStatusLabel = () => {
    switch (appleMusicAuthStatus) {
      case "authorized":
        return "Authorized";
      case "denied":
        return "Denied";
      case "restricted":
        return "Restricted";
      case "notDetermined":
        return "Not connected";
      default:
        return "Unknown";
    }
  };

  const getAppleMusicSubscriptionAlertMessage = (error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : null;

    if (code === "privacyAcknowledgementRequired") {
      return "Open the Apple Music app once, accept the latest privacy notice, then try again.";
    }

    if (code === "permissionDenied") {
      return "Apple Music access is denied. Re-enable Media & Apple Music permissions in iOS Settings and try again.";
    }

    return "Could not verify your Apple Music subscription right now. Please try again.";
  };

  const ensureAppleMusicCatalogPlaybackAccess = async () => {
    try {
      const subscription = await checkAppleMusicSubscription();
      if (!subscription.canPlayCatalogContent) {
        setSongsPlaybackSource("youtube");
        Alert.alert(
          "Subscription Required",
          "Apple Music playback needs an active Apple Music subscription."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Apple Music subscription check failed:", error);
      setSongsPlaybackSource("youtube");
      Alert.alert(
        "Apple Music Unavailable",
        getAppleMusicSubscriptionAlertMessage(error)
      );
      return false;
    }
  };

  const handleAppleMusicLogin = async () => {
    if (Platform.OS !== "ios" || !isAppleMusicAuthAvailable) {
      Alert.alert(
        "Unsupported",
        "Apple Music login is only available on iOS development builds."
      );
      return;
    }

    try {
      const status = await requestAppleMusicAuthorization();
      setAppleMusicAuthStatus(status);

      if (status === "authorized") {
        const hasPlaybackAccess =
          await ensureAppleMusicCatalogPlaybackAccess();
        if (!hasPlaybackAccess) {
          return;
        }

        Alert.alert("Connected", "Apple Music is now authorized.");
        setSongsPlaybackSource("appleMusic");
      } else {
        Alert.alert(
          "Not Authorized",
          "Apple Music authorization was not granted."
        );
        setSongsPlaybackSource("youtube");
      }
    } catch (error) {
      console.error("Apple Music login failed:", error);
      Alert.alert(
        "Login Failed",
        "Could not complete Apple Music authorization. Check device Music settings and your Apple Music subscription."
      );
    }
  };

  const handlePlaybackSourceChange = async (
    source: "youtube" | "appleMusic"
  ) => {
    if (source === "youtube") {
      setSongsPlaybackSource("youtube");
      return;
    }

    if (Platform.OS !== "ios") {
      Alert.alert(
        "Not Available",
        "Apple Music playback is only available on iOS."
      );
      return;
    }

    if (!isAppleMusicAuthAvailable) {
      Alert.alert(
        "Setup Required",
        "Install an iOS development build to use Apple Music authentication."
      );
      return;
    }

    if (appleMusicAuthStatus !== "authorized") {
      Alert.alert(
        "Login Required",
        "Authorize Apple Music first, then switch playback to Apple Music."
      );
      return;
    }

    const hasPlaybackAccess = await ensureAppleMusicCatalogPlaybackAccess();
    if (!hasPlaybackAccess) {
      return;
    }

    setSongsPlaybackSource("appleMusic");
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleDevClearAndLogout = async () => {
    Alert.alert(
      "Clear All Data & Logout",
      "This will completely reset the app to its initial state, clearing all cache and logging you out. This is useful for debugging first-time user issues.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset App",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear all cache
              await clearCache();
              // Also clear large cache if present
              await clearLargeCache();
              // Logout using signOut from context (handles navigation)
              await signOut();
            } catch (error) {
              console.error("Error clearing app data:", error);
              Alert.alert(
                "Error",
                "Failed to clear app data. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleBadgeNotificationChange = async (value: boolean) => {
    setShowBadgeNotifications(value);

    if (value) {
      // If enabling, update badge with current count and schedule notifications
      await updateBadgeWithReviewCount();
      // Also update the native notification system
      await updateBadgeAndScheduleNotifications();
    } else {
      // If disabling, clear the badge immediately
      await clearBadgeCount();
      // Also clear native notifications if review notifications are also disabled
      if (
        Platform.OS === "ios" &&
        !enableReviewNotifications &&
        !isRunningOnMacFromIOS &&
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.updateBadgeAndScheduleNotifications ===
          "function"
      ) {
        try {
          await ReviewNotificationManager.updateBadgeAndScheduleNotifications({
            currentReviews: 0,
            upcomingReviews: new Array(24).fill(0),
            settings: {
              badgeEnabled: false,
              alertsEnabled: false,
              soundsEnabled: false,
            },
          });
        } catch (error) {
          console.error("Failed to clear native notifications:", error);
        }
      }
    }

    // Keep daily reminder scheduling in sync.
    await syncDailyReminderNotifications();
  };

  const handleReviewNotificationChange = async (value: boolean) => {
    setEnableReviewNotifications(value);

    if (value) {
      // If enabling, use the new native notification system
      const permissionGranted = await requestNotificationPermissions();
      if (permissionGranted) {
        await updateBadgeAndScheduleNotifications();
      }

      // Keep the old system as fallback for background checks
      await initializeReviewNotifications();
      await scheduleReviewChecks();
      await syncDailyReminderNotifications();
    } else {
      // If disabling, cancel all notifications (both old and new systems)
      await cancelReviewNotifications();

      if (showBadgeNotifications) {
        // Keep badge scheduling active when review alerts are disabled.
        await updateBadgeWithReviewCount({ forceSummaryRefresh: true });
        return;
      }

      // Also clear any native notifications
      if (
        Platform.OS === "ios" &&
        !isRunningOnMacFromIOS &&
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.updateBadgeAndScheduleNotifications ===
          "function"
      ) {
        try {
          await ReviewNotificationManager.updateBadgeAndScheduleNotifications({
            currentReviews: 0,
            upcomingReviews: new Array(24).fill(0),
            settings: {
              badgeEnabled: false,
              alertsEnabled: false,
              soundsEnabled: false,
            },
          });
        } catch (error) {
          console.error("Failed to clear native notifications:", error);
        }
      }

      await syncDailyReminderNotifications();
    }
  };

  const formatReminderTimeLabel = (hour: number, minute: number) => {
    const reminderDate = new Date();
    reminderDate.setHours(hour, minute, 0, 0);
    return reminderDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatExpoTriggerLabel = (trigger: unknown): string => {
    if (trigger == null) {
      return "Immediate";
    }

    if (typeof trigger !== "object") {
      return "Unknown trigger";
    }

    const triggerRecord = trigger as Record<string, unknown>;
    const triggerType =
      typeof triggerRecord.type === "string" ? triggerRecord.type : "unknown";

    if (
      triggerType === "daily" &&
      typeof triggerRecord.hour === "number" &&
      typeof triggerRecord.minute === "number"
    ) {
      return `Daily at ${formatReminderTimeLabel(
        triggerRecord.hour,
        triggerRecord.minute,
      )}`;
    }

    if (typeof triggerRecord.seconds === "number") {
      return `In ${Math.round(triggerRecord.seconds)}s`;
    }

    if (typeof triggerRecord.date === "number") {
      return new Date(triggerRecord.date).toLocaleString();
    }

    return triggerType;
  };

  const formatNativeTriggerLabel = (
    trigger: {
      type: string;
      fireDate?: string;
      repeats: boolean;
      timeInterval?: number;
    } | null
  ): string => {
    if (!trigger) {
      return "Unknown trigger";
    }

    if (trigger.fireDate) {
      return new Date(trigger.fireDate).toLocaleString();
    }

    if (trigger.type === "calendar") {
      return trigger.repeats
        ? "Calendar trigger (repeats daily)"
        : "Calendar trigger";
    }

    if (trigger.type === "timeInterval" && typeof trigger.timeInterval === "number") {
      return `In ${Math.round(trigger.timeInterval)}s`;
    }

    return trigger.type || "Unknown trigger";
  };

  const openReminderTimeModal = () => {
    setReminderHourDraft(dailyReviewReminderHour);
    setReminderMinuteDraft(dailyReviewReminderMinute);
    setShowReminderTimeModal(true);
  };

  const handleDailyReviewReminderChange = async (value: boolean) => {
    setDailyReviewReminderEnabled(value);

    if (value) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your device settings to receive reminder alerts.",
        );
      }
    }

    await syncDailyReminderNotifications();
  };

  const handleDailyLessonReminderChange = async (value: boolean) => {
    setDailyLessonReminderEnabled(value);

    if (value) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your device settings to receive reminder alerts.",
        );
      }
    }

    await syncDailyReminderNotifications();
  };

  const handleDailyLessonReminderMinimumChange = async (nextMinimum: number) => {
    const normalizedMinimum = normalizeToSteppedRange(
      nextMinimum,
      dailyLessonReminderMinimumMin,
      dailyLessonReminderMinimumMax,
      dailyLessonReminderMinimumStep,
    );
    setDailyLessonReminderMinimum(normalizedMinimum);
    await syncDailyReminderNotifications();
  };

  useEffect(() => {
    const normalizedMinimum = normalizeToSteppedRange(
      dailyLessonReminderMinimum,
      dailyLessonReminderMinimumMin,
      dailyLessonReminderMinimumMax,
      dailyLessonReminderMinimumStep,
    );
    if (normalizedMinimum !== dailyLessonReminderMinimum) {
      setDailyLessonReminderMinimum(normalizedMinimum);
    }
  }, [
    dailyLessonReminderMinimum,
    dailyLessonReminderMinimumStep,
    setDailyLessonReminderMinimum,
  ]);

  const handleSaveReminderTime = async () => {
    setDailyReviewReminderHour(reminderHourDraft);
    setDailyReviewReminderMinute(reminderMinuteDraft);
    setShowReminderTimeModal(false);

    await syncDailyReminderNotifications();
  };

  const getCurrentVoiceDisplayName = () => {
    const voice = JAPANESE_VOICES.find((v) => v.shortName === selectedVoice);
    return voice?.displayName || selectedVoice;
  };

  const getVocabularyAudioVoiceLabel = (
    voice: VocabularyAudioVoicePreference,
  ) => {
    return (
      VOCABULARY_AUDIO_VOICE_LABELS[voice] ??
      VOCABULARY_AUDIO_VOICE_LABELS.female
    );
  };

  const getSrsProgressionCardModeLabel = (
    mode: SrsProgressionCardDisplayMode,
  ) => {
    return (
      SRS_PROGRESSION_CARD_MODE_LABELS[mode] ??
      SRS_PROGRESSION_CARD_MODE_LABELS.normal
    );
  };

  const getVocabularyAudioVoiceIconName = (
    voice: VocabularyAudioVoicePreference,
  ): keyof typeof Ionicons.glyphMap => {
    switch (voice) {
      case "random":
        return "shuffle";
      case "both":
        return "people-outline";
      default:
        return "person-outline";
    }
  };

  const getSrsProgressionCardModeIconName = (
    mode: SrsProgressionCardDisplayMode,
  ): keyof typeof Ionicons.glyphMap => {
    switch (mode) {
      case "compact":
        return "contract-outline";
      case "hidden":
        return "eye-off-outline";
      default:
        return "expand-outline";
    }
  };

  const closeVocabularyAudioVoicePicker = () => {
    setShowVocabularyVoiceMenu(false);
  };

  const closeSrsProgressionCardModePicker = () => {
    setShowSrsProgressionCardModeMenu(false);
  };

  const selectVocabularyAudioVoice = (
    voice: VocabularyAudioVoicePreference,
  ) => {
    setVocabularyAudioVoice(voice);
    closeVocabularyAudioVoicePicker();
  };

  const selectSrsProgressionCardMode = (
    mode: SrsProgressionCardDisplayMode,
  ) => {
    setSrsProgressionCardDisplayMode(mode);
    closeSrsProgressionCardModePicker();
  };

  const handleOfflineVocabularyAudioToggle = (enabled: boolean) => {
    setOfflineVocabularyAudioEnabled(enabled);
    if (enabled) {
      void triggerOfflineAudioDownload({ forceReindex: true, enabled: true });
      return;
    }

    void queueOfflineVocabularyAudioDownloads({
      enabled: false,
      currentLevel: userData?.level ?? 1,
      voicePreference: "both",
    });

    Alert.alert(
      "Delete offline audio?",
      "You can keep the downloaded audio or delete it to free up space.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsClearingOfflineAudioCache(true);
            void clearOfflineVocabularyAudioCache()
              .then(() => refreshOfflineAudioCacheSize())
              .finally(() => setIsClearingOfflineAudioCache(false));
          },
        },
      ],
    );
  };

  const handleClearOfflineAudioCache = () => {
    Alert.alert(
      "Delete cached audio?",
      "This removes all downloaded vocabulary audio from your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsClearingOfflineAudioCache(true);
            void clearOfflineVocabularyAudioCache()
              .then(() => refreshOfflineAudioCacheSize())
              .finally(() => setIsClearingOfflineAudioCache(false));
          },
        },
      ],
    );
  };

  const openVocabularyAudioVoicePicker = () => {
    if (Platform.OS === "android") {
      setShowVocabularyVoiceMenu(true);
      return;
    }

    Alert.alert(
      "Vocabulary Audio Voice",
      "Choose the voice mode used after correct reading answers.",
      [
        ...VOCABULARY_AUDIO_VOICE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => selectVocabularyAudioVoice(option.value),
        })),
        { text: "Cancel", style: "destructive" as const },
      ],
    );
  };

  const openSrsProgressionCardModePicker = () => {
    if (Platform.OS === "android") {
      setShowSrsProgressionCardModeMenu(true);
      return;
    }

    Alert.alert(
      "SRS Progression",
      "Choose how SRS progression appears after answering review items.",
      [
        ...SRS_PROGRESSION_CARD_MODE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => selectSrsProgressionCardMode(option.value),
        })),
        { text: "Cancel", style: "destructive" as const },
      ],
    );
  };

  const openReviewShortcutModal = () => {
    setReviewIncorrectShortcutDraft(
      resolveReviewIncorrectKeyboardShortcuts(reviewIncorrectKeyboardShortcuts),
    );
    setReviewCorrectShortcutDraft(
      resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
    );
    setCapturingReviewShortcutKey(null);
    setShowReviewShortcutModal(true);
  };

  const closeReviewShortcutModal = () => {
    setCapturingReviewShortcutKey(null);
    setShowReviewShortcutModal(false);
  };

  const applyReviewShortcutValue = (
    target: ReviewShortcutCaptureTarget,
    nextValue: string,
  ) => {
    const sanitizedValue = sanitizeReviewShortcutInput(nextValue);

    if (target.group === "incorrect") {
      setReviewIncorrectShortcutDraft((current) => ({
        ...current,
        [target.key]: sanitizedValue,
      }));
      setReviewIncorrectKeyboardShortcuts({
        [target.key]: sanitizedValue,
      });
      return;
    }

    setReviewCorrectShortcutDraft((current) => ({
      ...current,
      [target.key]: sanitizedValue,
    }));
    setReviewCorrectKeyboardShortcuts({
      [target.key]: sanitizedValue,
    });
  };

  const beginReviewShortcutCapture = (
    target: ReviewShortcutCaptureTarget,
  ) => {
    if (
      (target.group === "incorrect" &&
        !disableAutoProgressOnWrong &&
        !disableAutoProgressOnCloseAnswer) ||
      (target.group === "correct" && !disableAutoProgressOnCorrect)
    ) {
      return;
    }

    setCapturingReviewShortcutKey(target);
  };

  const handleReviewShortcutCaptureKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    const pressedKey = event.nativeEvent.key;
    if (!pressedKey) {
      return;
    }

    const normalizedKey = normalizeReviewShortcutKey(pressedKey);
    const ignoredKeys = new Set([
      "shift",
      "control",
      "alt",
      "meta",
      "capslock",
    ]);

    if (ignoredKeys.has(normalizedKey)) {
      return;
    }

    if (normalizedKey === "backspace" || normalizedKey === "delete") {
      applyReviewShortcutValue(capturingReviewShortcutKey, "");
      setCapturingReviewShortcutKey(null);
      reviewShortcutCaptureInputRef.current?.blur();
      return;
    }

    applyReviewShortcutValue(capturingReviewShortcutKey, pressedKey);
    setCapturingReviewShortcutKey(null);
    reviewShortcutCaptureInputRef.current?.blur();
  };

  const handleReviewShortcutCaptureSubmit = () => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    applyReviewShortcutValue(capturingReviewShortcutKey, "Enter");
    setCapturingReviewShortcutKey(null);
    reviewShortcutCaptureInputRef.current?.blur();
  };

  const handleCacheAnalysis = async () => {
    setIsAnalyzingCache(true);
    try {
      const analysis = await analyzeCacheStorage();
      setCacheAnalysis(analysis);
      setShowCacheModal(true);
    } catch (error) {
      Alert.alert("Error", "Failed to analyze cache storage");
    } finally {
      setIsAnalyzingCache(false);
    }
  };

  const handleClearAllCache = async () => {
    Alert.alert(
      "Clear All Cache",
      "This will clear all cached data. You may need to re-download content when using the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearCache();
              Alert.alert("Success", "All cache has been cleared");
              // Refresh analysis if modal is open
              if (showCacheModal) {
                handleCacheAnalysis();
              }
            } catch (error) {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const handleClearLargeItems = async () => {
    Alert.alert(
      "Clear Large Items",
      "This will clear cache items larger than 5MB. This can help reduce storage usage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearLargeCache(undefined, 5);
              Alert.alert("Success", "Large cache items have been cleared");
              // Refresh analysis
              handleCacheAnalysis();
            } catch (error) {
              Alert.alert("Error", "Failed to clear large cache items");
            }
          },
        },
      ],
    );
  };

  const handleClearCategory = async (categoryName: string) => {
    Alert.alert(
      `Clear ${categoryName}`,
      `This will clear all cached data in the ${categoryName} category.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearLargeCache(categoryName);
              Alert.alert("Success", `${categoryName} cache has been cleared`);
              // Refresh analysis
              handleCacheAnalysis();
            } catch (error) {
              Alert.alert("Error", `Failed to clear ${categoryName} cache`);
            }
          },
        },
      ],
    );
  };

  const handleDetailedSubjectsAnalysis = async () => {
    try {
      await analyzeSubjectsCache();
      Alert.alert(
        "Analysis Complete",
        "Check the console for detailed subjects cache breakdown. This shows the difference between individual subject caches and collection caches.",
      );
    } catch (error) {
      Alert.alert("Error", "Failed to analyze subjects cache");
    }
  };

  const handleOptimizeCache = async () => {
    Alert.alert(
      "Optimize Cache",
      "This will remove duplicate data, expired entries, and enforce size limits. This could save 20-50MB of storage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Optimize",
          onPress: async () => {
            try {
              const result = await quickOptimize();

              Alert.alert(
                "Optimization Complete",
                `Saved ${result.savedSpaceFormatted} by removing ${
                  result.itemsRemoved
                } items.\n\n${result.optimizationsApplied.join("\n")}`,
              );

              // Refresh analysis if modal is open
              if (showCacheModal) {
                handleCacheAnalysis();
              }
            } catch (error) {
              Alert.alert("Error", `Failed to optimize cache ${error}`);
            }
          },
        },
      ],
    );
  };

  const handleShowPendingNotifications = async () => {
    try {
      if (
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.getPendingNotifications === "function"
      ) {
        const nativePendingNotifications =
          await ReviewNotificationManager.getPendingNotifications();
        setPendingNotifications(nativePendingNotifications);
        setExpoPendingNotifications([]);
        setShowNotificationsModal(true);
        return;
      }

      const expoScheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();
      setPendingNotifications({
        count: 0,
        notifications: [],
      });
      setExpoPendingNotifications(expoScheduledNotifications);
      setShowNotificationsModal(true);
    } catch (error) {
      Alert.alert("Error", "Failed to get pending notifications");
      console.error("Failed to get pending notifications:", error);
    }
  };

  const handleShowApiSummary = () => {
    console.log("\n📊 API Debug Summary (triggered from Settings)");
    apiDebugger.printSummary();
    Alert.alert(
      "API Summary",
      "API call summary has been printed to the console. Check the terminal/debugger for details.",
    );
  };

  const handleShowApiDetails = () => {
    console.log("\n📋 API Detailed Log (triggered from Settings)");
    apiDebugger.printDetailedLog();
    Alert.alert(
      "API Details",
      "Detailed API call log has been printed to the console. Check the terminal/debugger for timestamps and payloads.",
    );
  };

  const handleClearApiDebug = () => {
    apiDebugger.clear();
    clearInMemoryCache();
    Alert.alert(
      "Cleared",
      "API debug history and in-memory cache have been cleared.",
    );
  };

  const handleShowApiTimelineSummary = () => {
    console.log("\nAPI Timeline Summary (triggered from Settings)");
    apiDebugger.printTimelineSummary();
    Alert.alert(
      "Timeline Summary",
      "API timeline summary has been printed to the console.",
    );
  };

  const handleExportApiTimeline = async () => {
    try {
      const payload = apiDebugger.buildTimelineExportPayload();

      if (payload.entries.length === 0) {
        Alert.alert(
          "No timeline data",
          "No API requests were captured yet. Refresh dashboard data first, then try again.",
        );
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `wanikani-api-timeline-${timestamp}.json`;
      const exportFile = new File(Paths.document, filename);
      exportFile.write(JSON.stringify(payload, null, 2));

      await Share.share({
        title: "WaniKani API timeline JSON",
        message:
          Platform.OS === "android"
            ? `API timeline exported to:\n${exportFile.uri}`
            : undefined,
        url: exportFile.uri,
      });
    } catch (error) {
      console.error("Failed to export API timeline:", error);
      Alert.alert(
        "Export failed",
        "Could not export API timeline right now. Please try again.",
      );
    }
  };

  const handleClearApiTimeline = () => {
    apiDebugger.clearTimeline();
    Alert.alert("Cleared", "API timeline history has been cleared.");
  };

  // Cache health check handler
  const handleCheckCacheHealth = async () => {
    setIsCheckingCacheHealth(true);
    try {
      const status = await checkSubjectsCacheHealth();
      setCacheHealthStatus(status);

      if (status.isHealthy) {
        const expectedInfo = status.expectedSubjects
          ? ` (expected: ${status.expectedSubjects})`
          : "";
        Alert.alert(
          "Cache Healthy",
          `Your subjects cache is healthy.\n\n${status.validSubjects} subjects cached${expectedInfo}.`,
          [{ text: "OK" }],
        );
      } else {
        const issuesSummary = status.issues
          .map((i) => `• ${i.description}`)
          .join("\n");

        Alert.alert(
          "Cache Issues Detected",
          `The cache has ${status.issues.length} issue(s):\n\n${issuesSummary}\n\nWould you like to repair it?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Repair Now",
              onPress: () => handleRepairCache(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error checking cache health:", error);
      Alert.alert("Error", "Failed to check cache health.");
    } finally {
      setIsCheckingCacheHealth(false);
    }
  };

  // Function to fetch all subjects from API for repair
  const fetchAllSubjectsFromApi = async (token: string) => {
    const initialResponse = await getSubjects(
      token,
      {},
      { skipCollectionCache: true },
    );
    const completeResponse = await fetchAllPages(initialResponse, token);
    return {
      data: completeResponse.data,
      data_updated_at: completeResponse.data_updated_at,
      total_count: completeResponse.total_count,
    };
  };

  // Cache repair handler
  const handleRepairCache = async () => {
    if (!apiToken) {
      Alert.alert("Error", "No API token available. Please log in again.");
      return;
    }

    Alert.alert(
      "Repair Cache",
      "This will clear the cache and download fresh data from WaniKani. This may take a moment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Repair",
          onPress: async () => {
            setIsRepairingCache(true);
            try {
              // Force repair even if cache appears healthy - user explicitly requested it
              const result = await repairSubjectsCache(
                apiToken,
                fetchAllSubjectsFromApi,
                { force: true },
              );

              if (result.success) {
                setCacheHealthStatus(result.newStatus || null);
                Alert.alert("Cache Repaired", result.message, [{ text: "OK" }]);
              } else {
                Alert.alert("Repair Failed", result.message, [{ text: "OK" }]);
              }
            } catch (error) {
              console.error("Error repairing cache:", error);
              Alert.alert(
                "Error",
                "Failed to repair cache. Please try again later or reinstall the app.",
              );
            } finally {
              setIsRepairingCache(false);
            }
          },
        },
      ],
    );
  };

  const toggleLevelAnalyticsLevelSelection = (level: number) => {
    setSelectedLevelAnalyticsLevels((current) => {
      if (current.includes(level)) {
        return current.filter((item) => item !== level);
      }

      return [...current, level].sort((left, right) => left - right);
    });
  };

  const selectAllLevelAnalyticsLevels = () => {
    setSelectedLevelAnalyticsLevels(availableLevelAnalyticsLevels);
  };

  const clearLevelAnalyticsLevels = () => {
    setSelectedLevelAnalyticsLevels([]);
  };

  const handleOpenLevelAnalyticsExportModal = () => {
    if (availableLevelAnalyticsLevels.length === 0) {
      Alert.alert(
        "No data to export",
        "Level analytics aren't available yet. Refresh your dashboard data and try again.",
      );
      return;
    }

    setShowLevelAnalyticsExportModal(true);
  };

  const exportLevelAnalytics = async (
    format: LevelAnalyticsExportFormat,
    selectedLevels: number[],
  ) => {
    if (isExportingLevelAnalytics) {
      return;
    }

    setIsExportingLevelAnalytics(true);

    try {
      const baseParams = {
        subjects: dashboardData.subjects,
        assignments: dashboardData.assignments,
        reviewStatistics: dashboardData.reviewStatistics,
        levelProgressions: dashboardData.levelProgressions,
        resets: dashboardData.resets,
        currentLevel: dashboardData.currentLevel,
        username: userData?.username ?? "",
        selectedLevels,
      };

      let rowCount = 0;
      let csv = "";
      let datasetLabel = "";
      let filenamePrefix = "";

      if (format === "detailed") {
        const rows: LevelAnalyticsDetailedExportRow[] =
          buildLevelAnalyticsDetailedExportRows(baseParams);
        rowCount = rows.length;
        csv = serializeLevelAnalyticsDetailedExportRows(rows);
        datasetLabel = "Detailed";
        filenamePrefix = "level-analytics-detailed";
      } else {
        const rows: LevelAnalyticsExportRow[] =
          buildLevelAnalyticsExportRows(baseParams);
        rowCount = rows.length;
        csv = serializeLevelAnalyticsExportRows(rows);
        datasetLabel = "Summary";
        filenamePrefix = "level-analytics-summary";
      }

      if (rowCount === 0) {
        Alert.alert(
          "No rows to export",
          "No analytics rows matched your selected levels.",
        );
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${filenamePrefix}-${timestamp}.csv`;
      const exportFile = new File(Paths.document, filename);
      exportFile.write(csv);

      // Stop showing spinner before opening system share sheet.
      setIsExportingLevelAnalytics(false);

      await Share.share({
        title: `${datasetLabel} level analytics CSV`,
        message:
          Platform.OS === "android"
            ? `${datasetLabel} level analytics CSV exported to:\n${exportFile.uri}`
            : undefined,
        url: exportFile.uri,
      });
    } catch (error) {
      console.error("Failed to export level analytics:", error);
      Alert.alert(
        "Export failed",
        "Could not export level analytics right now. Please try again.",
      );
    } finally {
      setIsExportingLevelAnalytics(false);
    }
  };

  const handleConfirmLevelAnalyticsExport = async () => {
    if (selectedLevelAnalyticsLevels.length === 0) {
      Alert.alert(
        "Select levels",
        "Choose at least one level before exporting analytics.",
      );
      return;
    }

    const selectedSnapshot = [...selectedLevelAnalyticsLevels];
    const formatSnapshot = levelAnalyticsExportFormat;

    setShowLevelAnalyticsExportModal(false);
    // On iOS, presenting Share immediately while this modal is dismissing can fail silently.
    // Queue export until the dismissal animation has finished.
    setTimeout(() => {
      void exportLevelAnalytics(formatSnapshot, selectedSnapshot);
    }, 250);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <OpenSourceModal
        visible={showOpenSourceModal}
        onClose={() => setShowOpenSourceModal(false)}
      />

      <View
        style={[styles.header, { backgroundColor: theme.headerBackground }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>
          Settings
        </Text>
      </View>

      <View
        style={[
          styles.sectionChipBar,
          {
            borderBottomColor: theme.border,
            backgroundColor: theme.backgroundColor,
          },
        ]}
        onLayout={(event) => {
          setSectionChipBarWidth(event.nativeEvent.layout.width);
        }}
      >
        <ScrollView
          ref={sectionChipScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionChipContent}
        >
          {sectionChips.map((sectionChip) => {
            const isSelected = selectedSectionKey === sectionChip.key;

            return (
              <TouchableOpacity
                key={sectionChip.key}
                style={[
                  styles.sectionChip,
                  {
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected
                      ? theme.primary
                      : theme.cardBackground,
                  },
                ]}
                onLayout={(event) => {
                  const { x, width } = event.nativeEvent.layout;
                  updateSectionChipLayout(sectionChip.key, x, width);
                }}
                onPress={() => {
                  scrollToSection(sectionChip.key, true);
                }}
              >
                <Ionicons
                  name={sectionChip.icon}
                  size={14}
                  color={isSelected ? "#fff" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.sectionChipText,
                    { color: isSelected ? "#fff" : theme.textColor },
                  ]}
                >
                  {sectionChip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        ref={scrollViewRef}
        onScroll={handleSettingsScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: settingsBottomPadding }}
      >
        {/* Support Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("support", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Support
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/issues")}
          >
            <Ionicons
              name="people-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Issues & Feedback
              </Text>

              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Join the discussion, report bugs, and request features
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => setShowOpenSourceModal(true)}
          >
            <View style={styles.settingIcon}>
              <GitHubMark
                size={24}
                color={theme.isDark ? "#FFFFFF" : "#24292F"}
                accessibilityLabel="GitHub"
              />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Open Source
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Contribute to Kakehashi or star the repo
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingItem,
              {
                borderBottomColor: theme.border,
              },
            ]}
            onPress={() => {
              void handleRateAppPress();
            }}
          >
            <Ionicons
              name="star"
              size={24}
              color="#FFD700"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Rate App
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Help others discover this App
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => {
              void handlePatreonPress();
            }}
          >
            <MaterialCommunityIcons
              name="patreon"
              size={24}
              color="#f96854"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Patreon
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Support the app with recurring support
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingItem,
              {
                borderBottomColor:
                  showBunproSurvey || Platform.OS === "android"
                    ? theme.border
                    : "transparent",
              },
            ]}
            onPress={() => router.push("/whats-new")}
          >
            <Ionicons
              name="sparkles"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                What&apos;s New
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                See the latest updates
              </Text>
            </View>
            {lastSeenPatchNotesVersion !== getCurrentPatchNotesVersion() && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {showBunproSurvey && (
            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  borderBottomColor:
                    Platform.OS === "android" ? theme.border : "transparent",
                },
              ]}
              onPress={() => setShowBunproSurveyModal(true)}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Bunpro Survey
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  2 quick questions
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}

          {Platform.OS === "android" && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={() => router.push("/tip-developer")}
            >
              <Ionicons
                name="gift"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Tip Developer
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Support ongoing development
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Voice Settings Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("voice", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Japanese Voice
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleVoiceSelection}
          >
            <Ionicons
              name="volume-high"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Voice for context sentences
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {getCurrentVoiceDisplayName()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="play-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Autoplay Vocabulary Audio
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Automatically play audio after answering vocabulary reading
                questions
              </Text>
            </View>
            <Switch
              value={autoplayVocabularyAudio}
              onValueChange={setAutoplayVocabularyAudio}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="book"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Autoplay Lesson Reading Audio
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Automatically play vocabulary audio when opening the Reading
                tab during lessons
              </Text>
            </View>
            <Switch
              value={autoplayLessonReadingAudio}
              onValueChange={setAutoplayLessonReadingAudio}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {/* Voice Actor Selection (show when any vocab autoplay mode is enabled) */}
          {(autoplayVocabularyAudio || autoplayLessonReadingAudio) && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="person"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Voice Actor
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Choose Female, Male, Random, or Both playback
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.voiceSelectionButton,
                  { borderColor: theme.border },
                ]}
                onPress={openVocabularyAudioVoicePicker}
              >
                <View style={styles.voiceSelectionButtonContent}>
                  <Text
                    style={[
                      styles.voiceSelectionText,
                      { color: theme.textColor },
                    ]}
                  >
                    {getVocabularyAudioVoiceLabel(vocabularyAudioVoice)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={theme.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.settingItem, { borderBottomColor: "transparent" }]}>
            <Ionicons
              name="cloud-download-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Offline Vocabulary Audio
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Pre-download pronunciation audio by level so replay keeps working
                without internet. Storage use is typically 50 MB to ~300 MB
                depending on your level.
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.textSecondary, marginTop: 6 },
                ]}
              >
                {offlineAudioProgress.inProgress
                  ? `Downloading ${offlineAudioProgress.completed}/${offlineAudioProgress.total} clips`
                  : `Cached clips: ${formatCount(offlineAudioCacheFileCount)} (${formatByteSize(
                      offlineAudioCacheSizeBytes,
                    )})`}
              </Text>
              <Text
                style={[
                  styles.settingSubtext,
                  { color: theme.textSecondary, marginTop: 4 },
                ]}
              >
                {`Scope: levels 1-${Math.max(
                  1,
                  Math.floor((userData?.level ?? 1) + 1),
                )}, both voices`}
              </Text>
            </View>
            <Switch
              value={offlineVocabularyAudioEnabled}
              onValueChange={handleOfflineVocabularyAudioToggle}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {offlineVocabularyAudioEnabled && (
            <View style={styles.offlineAudioDeleteRow}>
              <TouchableOpacity
                style={[
                  styles.offlineAudioDeleteIconButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
                onPress={handleClearOfflineAudioCache}
                disabled={isClearingOfflineAudioCache}
                accessibilityRole="button"
                accessibilityLabel="Delete offline vocabulary audio cache"
              >
                {isClearingOfflineAudioCache ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#d9534f" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Vocabulary Context Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("vocabContext", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Vocabulary Context
          </Text>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="pulse"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Pitch Accent Visualization
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show high/low pitch patterns in vocabulary details and lesson
                pages
              </Text>
            </View>
            <Switch
              value={showPitchAccent}
              onValueChange={setShowPitchAccent}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <MaterialCommunityIcons
              name="shape-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Patterns of Use
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show selectable usage patterns in vocabulary details and lesson
                pages
              </Text>
            </View>
            <Switch
              value={showPatternsOfUse}
              onValueChange={setShowPatternsOfUse}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <MaterialCommunityIcons
              name="compare-horizontal"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Similar Vocabulary
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show vocabulary with matching readings and meanings in
                vocabulary details
              </Text>
            </View>
            <Switch
              value={showSimilarVocabulary}
              onValueChange={setShowSimilarVocabulary}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="git-compare-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Single-Kanji Vocab Similar Kanji
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show visually similar kanji on vocabulary details and lessons
                when the vocabulary is exactly one kanji
              </Text>
            </View>
            <Switch
              value={showSingleKanjiVocabularySimilarKanji}
              onValueChange={setShowSingleKanjiVocabularySimilarKanji}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="eye-off"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Hide translations
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Hide English translations in vocabulary details and lessons
                until you tap to reveal
              </Text>
            </View>
            <Switch
              value={hideContextSentenceTranslations}
              onValueChange={setHideContextSentenceTranslations}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="speedometer"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Context Audio Speed Control
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show per-sentence playback speed controls in vocabulary context
              </Text>
            </View>
            <Switch
              value={showContextSentenceSpeedControl}
              onValueChange={setShowContextSentenceSpeedControl}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="film"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Media Context Sentences
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show vocabulary examples from anime, dramas, and games
              </Text>
            </View>
            <Switch
              value={showMediaContextSentences}
              onValueChange={setShowMediaContextSentences}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
          {showMediaContextSentences && (
            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  borderColor: theme.border,
                  borderBottomWidth: 0,
                },
              ]}
              onPress={() => router.push("/immersion-kit-settings")}
            >
              <Ionicons
                name="list"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Manage Anime List
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Manually select available animes
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("readingDefaults", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Reading Defaults
          </Text>

          <View
            style={[
              styles.settingItemColumn,
              { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
            ]}
          >
            <View style={[styles.settingRow, { marginBottom: 8 }]}>
              <Ionicons
                name="newspaper-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  NHK News Default View
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Pick the study mode that opens first in News articles.
                </Text>
              </View>
            </View>
            <View style={styles.playbackSelector}>
              {STUDY_MODE_DEFAULT_OPTIONS.map((option) => {
                const isBlocked =
                  option.value === "full" && !hasStoredJpdbApiKey;

                return (
                  <TouchableOpacity
                    key={`news-study-mode-${option.value}`}
                    style={[
                      styles.playbackSourceButton,
                      isBlocked ? { opacity: 0.6 } : null,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          newsDefaultStudyMode === option.value
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      if (isBlocked) {
                        handleBlockedFullModeSelection("news");
                        return;
                      }
                      setNewsDefaultStudyMode(option.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.playbackSourceButtonText,
                        {
                          color:
                            newsDefaultStudyMode === option.value
                              ? "#fff"
                              : theme.textColor,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.settingItemColumn, { borderBottomColor: "transparent" }]}>
            <View style={[styles.settingRow, { marginBottom: 8 }]}>
              <Ionicons
                name="musical-notes-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Song Lyrics Default View
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Pick the default highlight mode for lyric lines.
                </Text>
              </View>
            </View>
            <View style={styles.playbackSelector}>
              {STUDY_MODE_DEFAULT_OPTIONS.map((option) => {
                const isBlocked =
                  option.value === "full" && !hasStoredJpdbApiKey;

                return (
                  <TouchableOpacity
                    key={`lyrics-study-mode-${option.value}`}
                    style={[
                      styles.playbackSourceButton,
                      isBlocked ? { opacity: 0.6 } : null,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          songsLyricsDefaultStudyMode === option.value
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => {
                      if (isBlocked) {
                        handleBlockedFullModeSelection("lyrics");
                        return;
                      }
                      setSongsLyricsDefaultStudyMode(option.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.playbackSourceButtonText,
                        {
                          color:
                            songsLyricsDefaultStudyMode === option.value
                              ? "#fff"
                              : theme.textColor,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {showMusicPlaybackSection && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onLayout={(event) => {
              updateSectionOffset("musicPlayback", event.nativeEvent.layout.y);
            }}
          >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Music Playback
          </Text>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="play-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Playback Source
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Choose between YouTube video playback or Apple Music playback
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.settingItem,
              { borderBottomColor: Platform.OS === "ios" ? theme.border : "transparent" },
            ]}
          >
            <View style={styles.playbackSelector}>
              <TouchableOpacity
                style={[
                  styles.playbackSourceButton,
                  {
                    borderColor: theme.border,
                    backgroundColor:
                      songsPlaybackSource === "youtube"
                        ? theme.primary
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  void handlePlaybackSourceChange("youtube");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.playbackSourceButtonText,
                    {
                      color:
                        songsPlaybackSource === "youtube"
                          ? "#fff"
                          : theme.textColor,
                    },
                  ]}
                >
                  YouTube
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.playbackSourceButton,
                  {
                    borderColor: theme.border,
                    backgroundColor:
                      songsPlaybackSource === "appleMusic"
                        ? theme.primary
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  void handlePlaybackSourceChange("appleMusic");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.playbackSourceButtonText,
                    {
                      color:
                        songsPlaybackSource === "appleMusic"
                          ? "#fff"
                          : theme.textColor,
                    },
                  ]}
                >
                  Apple Music
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.settingItemColumn,
              { borderBottomColor: "transparent" },
            ]}
          >
            <View style={styles.settingRow}>
              <Ionicons
                name="logo-apple"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Apple Music Login
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Authorize Apple Music access for native catalog playback
                </Text>
              </View>
            </View>

            <View style={styles.musicLoginActions}>
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  { backgroundColor: theme.primary },
                  isAppleMusicAuthenticating && styles.syncButtonDisabled,
                ]}
                onPress={handleAppleMusicLogin}
                activeOpacity={0.7}
                disabled={isAppleMusicAuthenticating}
              >
                {isAppleMusicAuthenticating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.syncButtonText, { color: "#fff" }]}>
                    Login / Refresh
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.syncStatusText, { color: theme.textSecondary }]}>
              Status: {getAppleMusicStatusLabel()}
            </Text>
            {appleMusicAuthError && (
              <Text style={[styles.syncStatusText, { color: theme.error }]}>
                {appleMusicAuthError.message}
              </Text>
            )}
          </View>
          </View>
        )}

        {/* Lesson Settings Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("lessons", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Lesson Settings
          </Text>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="layers"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Lesson Batch Size
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Number of items per lesson batch (2-10)
              </Text>
            </View>
            <View style={styles.batchSizeSelector}>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  lessonBatchSize <= 2 && styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  lessonBatchSize > 2 && setLessonBatchSize(lessonBatchSize - 1)
                }
                disabled={lessonBatchSize <= 2}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={
                    lessonBatchSize <= 2 ? theme.textSecondary : theme.textColor
                  }
                />
              </TouchableOpacity>
              <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
                {lessonBatchSize}
              </Text>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  lessonBatchSize >= 10 && styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  lessonBatchSize < 10 &&
                  setLessonBatchSize(lessonBatchSize + 1)
                }
                disabled={lessonBatchSize >= 10}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={
                    lessonBatchSize >= 10
                      ? theme.textSecondary
                      : theme.textColor
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.settingItem,
              {
                borderBottomColor: isDailyLessonLimitEnabled
                  ? theme.border
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Daily Lesson Limit
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Cap lessons per day in your device timezone
              </Text>
            </View>
            <Switch
              value={isDailyLessonLimitEnabled}
              onValueChange={handleDailyLessonLimitToggle}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {isDailyLessonLimitEnabled && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="options"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Daily Limit
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {`Number of lessons per day (${dailyLessonLimitMin}-${dailyLessonLimitMax}, step ${dailyLessonLimitStep})`}
                </Text>
              </View>
              <View style={styles.batchSizeSelector}>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    dailyLessonLimit <= dailyLessonLimitMin &&
                      styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    dailyLessonLimit > dailyLessonLimitMin &&
                    setDailyLessonLimit(
                      getPreviousDailyLessonLimit(dailyLessonLimit)
                    )
                  }
                  disabled={dailyLessonLimit <= dailyLessonLimitMin}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={
                      dailyLessonLimit <= dailyLessonLimitMin
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
                <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
                  {dailyLessonLimit}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    dailyLessonLimit >= dailyLessonLimitMax &&
                      styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    dailyLessonLimit < dailyLessonLimitMax &&
                    setDailyLessonLimit(getNextDailyLessonLimit(dailyLessonLimit))
                  }
                  disabled={dailyLessonLimit >= dailyLessonLimitMax}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      dailyLessonLimit >= dailyLessonLimitMax
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/lesson-order-settings")}
          >
            <Ionicons
              name="funnel"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Lesson Order
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {lessonTypeOrderEnabled
                  ? `${getLessonOrderLabel(lessonOrder)} + type groups`
                  : interleaveLessonTypesEnabled
                    ? `${getLessonOrderLabel(lessonOrder)} + interleaved mix`
                    : getLessonOrderLabel(lessonOrder)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="list-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Lesson Picker List View
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Use unlock-style list view for lesson selection (default: cards)
              </Text>
            </View>
            <Switch
              value={lessonPickerViewMode === "list"}
              onValueChange={(enabled) =>
                setLessonPickerViewMode(enabled ? "list" : "cards")
              }
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="language-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Hide Kana Vocabulary
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Exclude kana vocabulary from lessons and lesson counts
              </Text>
            </View>
            <Switch
              value={excludeKanaVocabularyFromLessons}
              onValueChange={setExcludeKanaVocabularyFromLessons}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="reader"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Single Page View
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show all lesson content in one scrollable page instead of tabs
              </Text>
            </View>
            <Switch
              value={singlePageLessonView}
              onValueChange={setSinglePageLessonView}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="play-skip-forward-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Skip Custom Lesson Quiz
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Skip the quiz step in custom lessons
              </Text>
            </View>
            <Switch
              value={skipCustomLessonQuiz}
              onValueChange={setSkipCustomLessonQuiz}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Mnemonic Illustrations
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show radical mnemonic images in subject details and lesson pages
              </Text>
            </View>
            <Switch
              value={showMnemonicIllustrations}
              onValueChange={setShowMnemonicIllustrations}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        {/* Subject Lists Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("subjectLists", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Subject Lists
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/subject-lists")}
          >
            <Ionicons
              name="list"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Manage Subject Lists
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Create and manage saved subject collections for custom study
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Review Settings Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("reviews", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Review Settings
          </Text>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="shuffle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Jitai (Font Randomizer)
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Randomize Japanese fonts during reviews and lesson quizzes to
                improve reading ability
              </Text>
            </View>
            <Switch
              value={jitaiEnabled}
              onValueChange={setJitaiEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {jitaiEnabled && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() => router.push("/jitai-font-settings")}
            >
              <Ionicons
                name="text"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Jitai Font Pool
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  {`${jitaiSelectedFontIds.length} selected. Manage fonts and downloads.`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="resize-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Character Size
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Scale the Japanese font size in reviews
              </Text>
            </View>
            <View style={styles.batchSizeSelector}>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  !canDecreaseReviewCharacterFontScale &&
                    styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  canDecreaseReviewCharacterFontScale &&
                  setReviewCharacterFontScale(
                    reviewCharacterFontScale -
                      REVIEW_CHARACTER_FONT_SCALE_STEP,
                  )
                }
                disabled={!canDecreaseReviewCharacterFontScale}
                accessibilityRole="button"
                accessibilityLabel="Decrease review character size"
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={
                    canDecreaseReviewCharacterFontScale
                      ? theme.textColor
                      : theme.textSecondary
                  }
                />
              </TouchableOpacity>
              <Text
                style={[
                  styles.batchSizeValue,
                  styles.reviewCharacterSizeValue,
                  { color: theme.textColor },
                ]}
              >
                {formatReviewCharacterFontScale(reviewCharacterFontScale)}
              </Text>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  !canIncreaseReviewCharacterFontScale &&
                    styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  canIncreaseReviewCharacterFontScale &&
                  setReviewCharacterFontScale(
                    reviewCharacterFontScale +
                      REVIEW_CHARACTER_FONT_SCALE_STEP,
                  )
                }
                disabled={!canIncreaseReviewCharacterFontScale}
                accessibilityRole="button"
                accessibilityLabel="Increase review character size"
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={
                    canIncreaseReviewCharacterFontScale
                      ? theme.textColor
                      : theme.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.settingItem,
              {
                borderBottomColor: ankiCardMode ? theme.border : "transparent",
              },
            ]}
          >
            <Ionicons
              name="card"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Anki Card Mode
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Reveal answers on tap with self-grading controls
              </Text>
            </View>
            <Switch
              value={ankiCardMode}
              onValueChange={setAnkiCardMode}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {ankiCardMode && (
            <TouchableOpacity
              style={[styles.settingItemColumn, { borderBottomColor: theme.border }]}
              onPress={() => router.push("/anki-settings")}
              activeOpacity={0.78}
            >
              <View style={styles.settingRow}>
                <Ionicons
                  name="options-outline"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Anki Advanced Settings
                  </Text>
                  <Text
                    style={[styles.settingSubtext, { color: theme.textSecondary }]}
                  >
                    {`Applies to ${ankiCardModeScope}. ${ankiGroupQuestions ? "Grouped cards enabled." : "Grouped cards disabled."}`}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/review-order-settings")}
          >
            <Ionicons
              name="funnel"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Order
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {reviewTypeOrderEnabled
                  ? `${getReviewOrderLabel(reviewOrder)} + type groups`
                  : getReviewOrderLabel(reviewOrder)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="trending-up"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Prioritize Critical Items
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show current-level apprentice radicals/kanji first
              </Text>
            </View>
            <Switch
              value={prioritizeCriticalItems}
              onValueChange={setPrioritizeCriticalItems}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="pause-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Pause on Wrong Answer
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show correct answer and options before progressing
              </Text>
            </View>
            <Switch
              value={disableAutoProgressOnWrong}
              onValueChange={setDisableAutoProgressOnWrong}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="warning"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Pause on Close Answer
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                For fuzzy meaning matches, confirm whether to mark correct or incorrect
              </Text>
            </View>
            <Switch
              value={disableAutoProgressOnCloseAnswer}
              onValueChange={setDisableAutoProgressOnCloseAnswer}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="play-skip-forward"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Allow Skipping Reviews
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Submit an empty answer to move the item to the end and reset it
              </Text>
            </View>
            <Switch
              value={allowSkippingReviews}
              onValueChange={setAllowSkippingReviews}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Pause on Correct Answer
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show accepted answers before progressing
              </Text>
            </View>
            <Switch
              value={disableAutoProgressOnCorrect}
              onValueChange={setDisableAutoProgressOnCorrect}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={openReviewShortcutModal}
          >
            <FontAwesome
              name="keyboard-o"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Key Shortcuts
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                External keyboards only
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="information-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show Details on Answer Pause
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Slide subject details below the answer field when reviews pause
              </Text>
            </View>
            <View style={styles.settingTrailingControls}>
              <TouchableOpacity
                style={[
                  styles.settingHelpButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                  },
                ]}
                onPress={() => setShowAnswerStopDetailsPreview(true)}
                activeOpacity={0.75}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Preview answer pause details setting"
              >
                <Ionicons
                  name="help"
                  size={16}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              <Switch
                value={showAnswerStopSubjectDetails}
                onValueChange={setShowAnswerStopSubjectDetails}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="pricetags"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Accept User Synonyms
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Accept your custom synonyms as correct meaning answers
              </Text>
            </View>
            <Switch
              value={acceptUserSynonymsAsAnswers}
              onValueChange={setAcceptUserSynonymsAsAnswers}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="add-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show + Synonym Button
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show the synonym action when a meaning answer is paused as wrong
              </Text>
            </View>
            <Switch
              value={showAddSynonymButton}
              onValueChange={setShowAddSynonymButton}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="school-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Accept Any On&apos;yomi (Kanji)
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Treat all on&apos;yomi readings as correct in kanji reading
                reviews
              </Text>
            </View>
            <Switch
              value={acceptAnyKanjiOnyomiReading}
              onValueChange={setAcceptAnyKanjiOnyomiReading}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="swap-vertical"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Back-to-Back Questions
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show meaning and reading questions consecutively for each item
              </Text>
            </View>
            <Switch
              value={backToBackQuestions}
              onValueChange={setBackToBackQuestions}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              disabled={
                ankiCardMode &&
                ankiGroupQuestions &&
                ankiCardModeScope === "both"
              }
            />
          </View>

          {backToBackQuestions &&
          !(ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both") ? (
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="flash-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Immediate Retry on Wrong
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Re-ask failed questions right away in back-to-back mode
                </Text>
              </View>
              <Switch
                value={backToBackImmediateRetryIncorrect}
                onValueChange={setBackToBackImmediateRetryIncorrect}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          ) : null}

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="flag"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Wrap Up Target
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Subjects left after tapping Wrap Up (5-20). Paired questions stay within {effectiveReviewWrapUpQuestionGap} questions.
              </Text>
            </View>
            <View style={styles.batchSizeSelector}>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin &&
                    styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  reviewWrapUpTargetSubjects > reviewWrapUpTargetMin &&
                  setReviewWrapUpTargetSubjects(
                    reviewWrapUpTargetSubjects - reviewWrapUpTargetStep,
                  )
                }
                disabled={reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={
                    reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin
                      ? theme.textSecondary
                      : theme.textColor
                  }
                />
              </TouchableOpacity>
              <Text
                style={[styles.batchSizeValue, { color: theme.textColor }]}
              >
                {reviewWrapUpTargetSubjects}
              </Text>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax &&
                    styles.batchSizeButtonDisabled,
                ]}
                onPress={() =>
                  reviewWrapUpTargetSubjects < reviewWrapUpTargetMax &&
                  setReviewWrapUpTargetSubjects(
                    reviewWrapUpTargetSubjects + reviewWrapUpTargetStep,
                  )
                }
                disabled={reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={
                    reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax
                      ? theme.textSecondary
                      : theme.textColor
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="search"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Search Button
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show a search shortcut below Wrap Up during reviews
              </Text>
            </View>
            <Switch
              value={reviewSearchButtonEnabled}
              onValueChange={setReviewSearchButtonEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {KeyboardManager && (Platform.OS === "ios" || Platform.OS === "android") && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="language"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Switch to Japanese Keyboard
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Automatically switch to a Japanese keyboard for reading answers
                </Text>
              </View>
              <Switch
                value={autoSwitchKeyboard}
                onValueChange={async (value) => {
                  if (value && KeyboardManager) {
                    const hasJa = await KeyboardManager.hasJapaneseKeyboard();
                    if (!hasJa) {
                      Alert.alert(
                        "No Japanese Keyboard",
                        JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS
                      );
                      return;
                    }
                  }
                  setAutoSwitchKeyboard(value);
                }}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          )}

          {Platform.OS === "ios" && (
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="mic"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Voice Review Answers
                  </Text>
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaBadgeText}>BETA</Text>
                  </View>
                </View>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Answer review questions with speech recognition
                </Text>
              </View>
              <Switch
                value={voiceReviewAnswersEnabled}
                onValueChange={setVoiceReviewAnswersEnabled}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          )}

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingIcon}>
              <SrsProgressionSettingIcon size={24} color={theme.primary} />
            </View>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                SRS Progression
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show the new SRS stage of the submitted answer
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.voiceSelectionButton,
                { borderColor: theme.border },
              ]}
              onPress={openSrsProgressionCardModePicker}
              activeOpacity={0.7}
            >
              <View style={styles.voiceSelectionButtonContent}>
                <Text
                  style={[
                    styles.voiceSelectionText,
                    { color: theme.textColor },
                  ]}
                >
                  {getSrsProgressionCardModeLabel(srsProgressionCardDisplayMode)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={theme.textSecondary}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show Item Level & SRS Stage
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Display the subject level and current SRS stage during reviews
              </Text>
            </View>
            <Switch
              value={showReviewItemLevelAndSrsStage}
              onValueChange={setShowReviewItemLevelAndSrsStage}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="move-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Animate Previous Question
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Move the previous answer card from center to top-left
              </Text>
            </View>
            <Switch
              value={reviewAnimatePreviousQuestion}
              onValueChange={setReviewAnimatePreviousQuestion}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[
              styles.settingItem,
              {
                borderBottomColor: reviewBatchSizeEnabled
                  ? theme.border
                  : "transparent",
              },
            ]}
          >
            <Ionicons
              name="layers"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Batch Size
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Cap the number of reviews loaded into the queue
              </Text>
            </View>
            <Switch
              value={reviewBatchSizeEnabled}
              onValueChange={setReviewBatchSizeEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {reviewBatchSizeEnabled && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="options"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Batch Size
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Number of items per review session (5-100)
                </Text>
              </View>
              <View style={styles.batchSizeSelector}>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    reviewBatchSize <= 5 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    reviewBatchSize > 5 &&
                    setReviewBatchSize(reviewBatchSize - 5)
                  }
                  disabled={reviewBatchSize <= 5}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={
                      reviewBatchSize <= 5
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={[styles.batchSizeValue, { color: theme.textColor }]}
                >
                  {reviewBatchSize}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    reviewBatchSize >= 100 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    reviewBatchSize < 100 &&
                    setReviewBatchSize(reviewBatchSize + 5)
                  }
                  disabled={reviewBatchSize >= 100}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      reviewBatchSize >= 100
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Feedback Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("haptic", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Haptic
          </Text>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <MaterialIcons
              name="vibration"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Haptic Feedback
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Vibrate on key actions across the app
              </Text>
            </View>
            <Switch
              value={hapticFeedbackEnabled}
              onValueChange={setHapticFeedbackEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        {/* Kanji Learning Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("kanji", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Kanji Learning
          </Text>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="brush"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Stroke Order Animation
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show animated stroke order in kanji details
              </Text>
            </View>
            <Switch
              value={showStrokeOrder}
              onValueChange={setShowStrokeOrder}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="create-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Stroke Strictness
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Tolerance for stroke accuracy
              </Text>
            </View>
            <View style={styles.batchSizeSelector}>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  strokeLeniency <= 0.8 && styles.batchSizeButtonDisabled,
                ]}
                onPress={() => {
                  const levels = [0.8, 1.2, 1.8, 2.5];
                  // Find closest level index for legacy values
                  const currentIdx = levels.findIndex(
                    (l, i) => strokeLeniency <= l || i === levels.length - 1,
                  );
                  if (currentIdx > 0) {
                    setStrokeLeniency(levels[currentIdx - 1]);
                  }
                }}
                disabled={strokeLeniency <= 0.8}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={
                    strokeLeniency <= 0.8
                      ? theme.textSecondary
                      : theme.textColor
                  }
                />
              </TouchableOpacity>
              <Text style={[styles.leniencyValue, { color: theme.textColor }]}>
                {strokeLeniency <= 0.8
                  ? "Very Strict"
                  : strokeLeniency <= 1.2
                    ? "Strict"
                    : strokeLeniency <= 1.8
                      ? "Lenient"
                      : "Very Lenient"}
              </Text>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  strokeLeniency >= 2.5 && styles.batchSizeButtonDisabled,
                ]}
                onPress={() => {
                  const levels = [0.8, 1.2, 1.8, 2.5];
                  // Find closest level index for legacy values
                  const currentIdx = levels.findIndex(
                    (l, i) => strokeLeniency <= l || i === levels.length - 1,
                  );
                  if (currentIdx < levels.length - 1) {
                    setStrokeLeniency(levels[currentIdx + 1]);
                  } else if (strokeLeniency > 2.5) {
                    // Handle legacy values above max - snap to max
                    setStrokeLeniency(2.5);
                  }
                }}
                disabled={strokeLeniency >= 2.5}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={
                    strokeLeniency >= 2.5
                      ? theme.textSecondary
                      : theme.textColor
                  }
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Text
              style={[
                styles.settingIcon,
                {
                  fontSize: 20,
                  fontWeight: "bold",
                  color: theme.primary,
                  width: 24,
                  textAlign: "center",
                },
              ]}
            >
              ア
            </Text>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Katakana Madness
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Display On&apos;yomi readings in katakana instead of hiragana
              </Text>
            </View>
            <Switch
              value={showOnyomiInKatakana}
              onValueChange={setShowOnyomiInKatakana}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="copy-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Similar Kanji Source
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {visuallySimilarKanjiSource === "wanikani"
                  ? "Using WaniKani's built-in similar kanji"
                  : "Using Niai community database (more comprehensive)"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.voiceSelectionButton,
                { borderColor: theme.border },
              ]}
              onPress={() =>
                setVisuallySimilarKanjiSource(
                  visuallySimilarKanjiSource === "wanikani" ? "niai" : "wanikani",
                )
              }
            >
              <Text
                style={[
                  styles.voiceSelectionText,
                  { color: theme.textColor },
                ]}
              >
                {visuallySimilarKanjiSource === "wanikani" ? "WaniKani" : "Niai"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* User Profile Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("profile", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            User Profile
          </Text>

          <View
            style={[
              styles.settingItemColumn,
              { borderBottomColor: "transparent" },
            ]}
          >
            <View style={[styles.settingRow, { marginBottom: 8 }]}>
              <Ionicons
                name="person-circle"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Gravatar Email
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Enter your email to display your Gravatar profile picture
                </Text>
              </View>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={gravatarEmailInput}
                onChangeText={setGravatarEmailInput}
                placeholder="Enter email address"
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onEndEditing={handleSaveGravatarEmail}
                style={[
                  styles.textInput,
                  {
                    flex: 1,
                    marginTop: 0,
                    borderColor: theme.border,
                    backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                    color: theme.textColor,
                  },
                ]}
              />
              <TouchableOpacity
                onPress={handleSaveGravatarEmail}
                style={[
                  styles.inputIconButton,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Ionicons name="checkmark" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.settingItemColumn,
              {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
                borderBottomColor: "transparent",
              },
            ]}
          >
            <View style={[styles.settingRow, { marginBottom: 8 }]}>
              <Ionicons
                name="key-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <View style={styles.settingHeadingRow}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    JPDB API Key
                  </Text>
                  <TouchableOpacity
                    style={styles.settingInfoButton}
                    onPress={handleJpdbApiKeyInfoPress}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="JPDB API key info"
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Used for parse-first vocabulary detection in news, EPUB reader, and URL Reader
                </Text>
              </View>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={jpdbApiKeyInput}
                onChangeText={(value) => {
                  setJpdbApiKeyInput(value);
                  setJpdbApiKeyStatus(null);
                }}
                placeholder="Paste JPDB API key"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                editable={!isLoadingJpdbApiKey && !isSavingJpdbApiKey}
                style={[
                  styles.textInput,
                  {
                    flex: 1,
                    marginTop: 0,
                    borderColor: theme.border,
                    backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                    color: theme.textColor,
                    opacity: isLoadingJpdbApiKey ? 0.7 : 1,
                  },
                ]}
              />
              <TouchableOpacity
                onPress={() => void handleSaveJpdbApiKey()}
                disabled={isLoadingJpdbApiKey || isSavingJpdbApiKey}
                style={[
                  styles.inputIconButton,
                  { backgroundColor: theme.primary },
                  (isLoadingJpdbApiKey || isSavingJpdbApiKey) &&
                    styles.syncButtonDisabled,
                ]}
              >
                {isSavingJpdbApiKey ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#fff" />
                )}
              </TouchableOpacity>
              {hasStoredJpdbApiKey ? (
                <TouchableOpacity
                  onPress={() => void handleRemoveJpdbApiKey()}
                  disabled={isLoadingJpdbApiKey || isSavingJpdbApiKey}
                  style={[
                    styles.inputIconButton,
                    { backgroundColor: theme.error },
                    (isLoadingJpdbApiKey || isSavingJpdbApiKey) &&
                      styles.syncButtonDisabled,
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
            {jpdbApiKeyStatus ? (
              <Text
                style={[
                  styles.syncStatusText,
                  {
                    color: jpdbApiKeyStatus.isError
                      ? theme.error
                      : theme.textSecondary,
                  },
                ]}
              >
                {jpdbApiKeyStatus.message}
              </Text>
            ) : null}
          </View>

          {isPortegoUser && (
            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
              ]}
              onPress={() => router.push("/url-reader")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="globe-outline"
                size={22}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  URL Reader
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Parse Japanese text from any URL with JPDB-first highlighting
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Appearance Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("appearance", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Appearance
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/tab-settings")}
          >
            <Ionicons
              name="apps"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Customize Tabs
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Choose which tabs to show in the navigation bar
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/subject-colors-settings")}
          >
            <Ionicons
              name="color-palette"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Subject Colors
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Customize radical, kanji, and vocabulary colors
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/home-customization-settings")}
          >
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Home Customization
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Reorder, add, remove, and theme Home widgets
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Theme Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("theme", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Theme
          </Text>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name={
                themeMode === "system"
                  ? "phone-portrait"
                  : themeMode === "midnight"
                    ? "contrast"
                    : themeMode === "sepia"
                      ? "leaf"
                      : isDark
                        ? "moon"
                        : "sunny"
              }
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Theme Preset
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {themeMode === "system"
                  ? "Following system appearance"
                  : themeMode === "midnight"
                    ? "Pure black dark mode"
                    : themeMode === "sepia"
                      ? "Warm paper-like light mode"
                      : isDark
                        ? "Always dark"
                        : "Always light"}
              </Text>
            </View>
          </View>
          <View
            style={[styles.themeSelector, { borderTopColor: theme.border }]}
          >
            <TouchableOpacity
              style={[
                styles.themeSelectorButton,
                { borderColor: theme.border },
                themeMode === "light" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setThemeMode("light")}
            >
              <Ionicons
                name="sunny"
                size={18}
                color={themeMode === "light" ? "#fff" : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeSelectorText,
                  { color: themeMode === "light" ? "#fff" : theme.textColor },
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeSelectorButton,
                { borderColor: theme.border },
                themeMode === "dark" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setThemeMode("dark")}
            >
              <Ionicons
                name="moon"
                size={18}
                color={themeMode === "dark" ? "#fff" : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeSelectorText,
                  { color: themeMode === "dark" ? "#fff" : theme.textColor },
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeSelectorButton,
                { borderColor: theme.border },
                themeMode === "midnight" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setThemeMode("midnight")}
            >
              <Ionicons
                name="contrast"
                size={18}
                color={themeMode === "midnight" ? "#fff" : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeSelectorText,
                  { color: themeMode === "midnight" ? "#fff" : theme.textColor },
                ]}
              >
                Midnight
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeSelectorButton,
                { borderColor: theme.border },
                themeMode === "sepia" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setThemeMode("sepia")}
            >
              <Ionicons
                name="leaf"
                size={18}
                color={themeMode === "sepia" ? "#fff" : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeSelectorText,
                  { color: themeMode === "sepia" ? "#fff" : theme.textColor },
                ]}
              >
                Sepia
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeSelectorButton,
                { borderColor: theme.border },
                themeMode === "system" && {
                  backgroundColor: theme.primary,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setThemeMode("system")}
            >
              <Ionicons
                name="phone-portrait"
                size={18}
                color={themeMode === "system" ? "#fff" : theme.textSecondary}
              />
              <Text
                style={[
                  styles.themeSelectorText,
                  { color: themeMode === "system" ? "#fff" : theme.textColor },
                ]}
              >
                System
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Widget Section */}
        {showWidgetsSection && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onLayout={(event) => {
              updateSectionOffset("widgets", event.nativeEvent.layout.y);
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              Widgets
            </Text>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={() => router.push("/widget-settings")}
            >
              <Ionicons
                name="phone-portrait"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Home Widget
                  </Text>
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaBadgeText}>BETA</Text>
                  </View>
                </View>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Configure widget content and streak background gradient
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Notifications Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("notifications", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Notifications
          </Text>

          {Platform.OS !== "android" && (
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="notifications"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  App Badge Notifications
                </Text>
                <Text
                  style={[styles.settingSubtext, { color: theme.textSecondary }]}
                >
                  Show review count in app icon badge
                </Text>
              </View>
              <Switch
                value={showBadgeNotifications}
                onValueChange={handleBadgeNotificationChange}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
          )}

          <View
            style={[
              styles.settingItem,
              {
                borderBottomColor:
                  Platform.OS === "ios" ||
                  Platform.OS === "android" ||
                  __DEV__
                    ? theme.border
                    : "transparent",
              },
            ]}
          >
            <Ionicons
              name="alarm"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Review Notifications
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Get notified when new reviews become available
              </Text>
            </View>
            <Switch
              value={enableReviewNotifications}
              onValueChange={handleReviewNotificationChange}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {(Platform.OS === "ios" || Platform.OS === "android") && (
            <>
              <View
                style={[styles.settingItem, { borderBottomColor: theme.border }]}
              >
                <Ionicons
                  name="time"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Daily Review Reminder
                  </Text>
                  <Text
                    style={[styles.settingSubtext, { color: theme.textSecondary }]}
                  >
                    Send one reminder at your chosen local time if reviews are still pending
                  </Text>
                </View>
                <Switch
                  value={dailyReviewReminderEnabled}
                  onValueChange={handleDailyReviewReminderChange}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>

              <View
                style={[styles.settingItem, { borderBottomColor: theme.border }]}
              >
                <Ionicons
                  name="book-outline"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Daily Lesson Reminder
                  </Text>
                  <Text
                    style={[styles.settingSubtext, { color: theme.textSecondary }]}
                  >
                    Send one reminder when your minimum daily lessons are not met and lessons are still available
                  </Text>
                </View>
                <Switch
                  value={dailyLessonReminderEnabled}
                  onValueChange={handleDailyLessonReminderChange}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>

              {dailyLessonReminderEnabled && (
                <View
                  style={[styles.settingItem, { borderBottomColor: theme.border }]}
                >
                  <Ionicons
                    name="options"
                    size={24}
                    color={theme.primary}
                    style={styles.settingIcon}
                  />
                  <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingText, { color: theme.textColor }]}>
                      Minimum Daily Lessons
                    </Text>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {`Set your daily lesson goal (${dailyLessonReminderMinimumMin}-${dailyLessonReminderMinimumMax}, step ${dailyLessonReminderMinimumStep})`}
                    </Text>
                  </View>
                  <View style={styles.batchSizeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.batchSizeButton,
                        { backgroundColor: theme.border },
                        dailyLessonReminderMinimum <=
                          dailyLessonReminderMinimumMin &&
                          styles.batchSizeButtonDisabled,
                      ]}
                      onPress={() =>
                        void handleDailyLessonReminderMinimumChange(
                          getPreviousDailyLessonReminderMinimum(
                            dailyLessonReminderMinimum
                          )
                        )
                      }
                      disabled={
                        dailyLessonReminderMinimum <=
                        dailyLessonReminderMinimumMin
                      }
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={
                          dailyLessonReminderMinimum <=
                          dailyLessonReminderMinimumMin
                            ? theme.textSecondary
                            : theme.textColor
                        }
                      />
                    </TouchableOpacity>
                    <Text
                      style={[styles.batchSizeValue, { color: theme.textColor }]}
                    >
                      {dailyLessonReminderMinimum}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.batchSizeButton,
                        { backgroundColor: theme.border },
                        dailyLessonReminderMinimum >=
                          dailyLessonReminderMinimumMax &&
                          styles.batchSizeButtonDisabled,
                      ]}
                      onPress={() =>
                        void handleDailyLessonReminderMinimumChange(
                          getNextDailyLessonReminderMinimum(
                            dailyLessonReminderMinimum
                          )
                        )
                      }
                      disabled={
                        dailyLessonReminderMinimum >=
                        dailyLessonReminderMinimumMax
                      }
                    >
                      <Ionicons
                        name="add"
                        size={18}
                        color={
                          dailyLessonReminderMinimum >=
                          dailyLessonReminderMinimumMax
                            ? theme.textSecondary
                            : theme.textColor
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.settingItem,
                  {
                    borderBottomColor: __DEV__ ? theme.border : "transparent",
                    opacity: isAnyDailyReminderEnabled ? 1 : 0.5,
                  },
                ]}
                disabled={!isAnyDailyReminderEnabled}
                onPress={openReminderTimeModal}
              >
                <Ionicons
                  name="time-outline"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Reminder Time
                  </Text>
                  <Text
                    style={[styles.settingSubtext, { color: theme.textSecondary }]}
                  >
                    Shared by daily review and lesson reminders
                  </Text>
                </View>
                <Text style={[styles.settingValueText, { color: theme.textColor }]}>
                  {formatReminderTimeLabel(
                    dailyReviewReminderHour,
                    dailyReviewReminderMinute,
                  )}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </>
          )}

          {__DEV__ && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={handleShowPendingNotifications}
            >
              <Ionicons
                name="list"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  View Scheduled Notifications
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Debug: See all pending notifications and badges
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Cache Management Section */}
        {/* <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Cache Management
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleCacheAnalysis}
            disabled={isAnalyzingCache}
          >
            <Ionicons
              name="analytics"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Analyze Cache Usage
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                View storage distribution and manage cache
              </Text>
            </View>
            {isAnalyzingCache ? (
              <View style={{ marginRight: 8 }}>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Analyzing...
                </Text>
              </View>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleOptimizeCache}
          >
            <Ionicons
              name="flash"
              size={24}
              color="#ff9500"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Optimize Cache
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Remove duplicates and old data (saves 20-50MB)
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() => setShowPerformanceDashboard(true)}
            >
              <Ionicons
                name="speedometer"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Performance Dashboard
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  View homepage refresh timing breakdown
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={handleClearAllCache}
          >
            <Ionicons
              name="trash"
              size={24}
              color="#e53935"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: "#e53935" }]}>
                Clear All Cache
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Remove all cached data to free up space
              </Text>
            </View>
          </TouchableOpacity>
        </View> */}

        {/* Data & Storage Section - Feature flagged by user email */}
        {showDataStorageSection && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onLayout={(event) => {
              updateSectionOffset("dataStorage", event.nativeEvent.layout.y);
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              Data & Storage
            </Text>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleCheckCacheHealth}
              disabled={isCheckingCacheHealth || isRepairingCache}
            >
              <Ionicons
                name="medkit"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Check Cache Health
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {cacheHealthStatus
                    ? cacheHealthStatus.isHealthy
                      ? `Healthy - ${cacheHealthStatus.validSubjects} subjects`
                      : `Issues detected - ${cacheHealthStatus.issues.length} problem(s)`
                    : "Verify search and offline data integrity"}
                </Text>
              </View>
              {isCheckingCacheHealth ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={handleRepairCache}
              disabled={isRepairingCache || isCheckingCacheHealth}
            >
              <Ionicons
                name="build"
                size={24}
                color="#ff9500"
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Repair Cache
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Fix corrupted data for search and offline mode
                </Text>
              </View>
              {isRepairingCache ? (
                <ActivityIndicator size="small" color="#ff9500" />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Level Recap */}
        {showLevelRecapSection && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onLayout={(event) => {
              updateSectionOffset("levelRecap", event.nativeEvent.layout.y);
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              Level Recap
            </Text>

            {dashboardData.currentLevel > 1 && (
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.border }]}
                onPress={() =>
                  router.push(`/level-wrapped/${dashboardData.currentLevel - 1}`)
                }
              >
                <View style={styles.settingIcon}>
                  <LevelRecapIcon size={24} color="#7c3aed" />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: theme.textColor }]}>
                    Level {dashboardData.currentLevel - 1} Summary
                  </Text>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    View your previous level recap
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={() => {
                handleOpenLevelAnalyticsExportModal();
              }}
              disabled={isExportingLevelAnalytics}
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Export Level Analytics
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Choose levels and export summary or detailed CSV
                </Text>
              </View>
              {isExportingLevelAnalytics ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Patreon Supporters Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("patreon", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Patreon Supporters
          </Text>
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/patreon-supporters")}
          >
            <MaterialCommunityIcons
              name="patreon"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                View Supporters
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                See all Patreon supporters and join them
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("account", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Account
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out"
              size={24}
              color="#e53935"
              style={styles.settingIcon}
            />
            <Text style={[styles.settingText, { color: "#e53935" }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* API Debug Section - Dev and Portego */}
        {canAccessApiDebugTools && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
            onLayout={(event) => {
              updateSectionOffset("apiDebug", event.nativeEvent.layout.y);
            }}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.textColor, borderBottomColor: theme.border },
              ]}
            >
              API Debug Tools
            </Text>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleShowApiTimelineSummary}
            >
              <Ionicons
                name="time"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Show API Timeline Summary
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Print request timeline stats with slowest calls
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleExportApiTimeline}
            >
              <Ionicons
                name="download-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Export API Timeline JSON
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Export URL, params, response preview, and timing per call
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleShowApiSummary}
            >
              <Ionicons
                name="bar-chart"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Show API Summary
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Print API call statistics to console
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleShowApiDetails}
            >
              <Ionicons
                name="list"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Show API Details
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Print detailed call log with timestamps and payloads
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={handleClearApiTimeline}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color="#ff9500"
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Clear API Timeline
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Remove captured request timeline entries only
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  borderBottomColor: __DEV__ ? theme.border : "transparent",
                },
              ]}
              onPress={handleClearApiDebug}
            >
              <Ionicons
                name="trash-bin"
                size={24}
                color="#ff9500"
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Clear API Debug History
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Reset API call history and in-memory cache
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {__DEV__ && (
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: "transparent" }]}
                onPress={handleDevClearAndLogout}
              >
                <Ionicons
                  name="bug"
                  size={24}
                  color="#ff3b30"
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingText, { color: "#ff3b30" }]}>
                    Clear All Data & Logout
                  </Text>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Completely reset app to fresh state (for debugging first-time
                    issues)
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showLevelAnalyticsExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLevelAnalyticsExportModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowLevelAnalyticsExportModal(false)}
        >
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.levelAnalyticsExportModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.voicePickerModalTitle,
                    { color: theme.textColor, paddingBottom: 8 },
                  ]}
                >
                  Export Level Analytics
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, paddingHorizontal: 16 },
                  ]}
                >
                  Select dataset type and levels to include in your CSV export.
                </Text>

                <View style={styles.levelAnalyticsFormatRow}>
                  <TouchableOpacity
                    style={[
                      styles.levelAnalyticsFormatButton,
                      {
                        borderColor:
                          levelAnalyticsExportFormat === "summary"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          levelAnalyticsExportFormat === "summary"
                            ? `${theme.primary}20`
                            : "transparent",
                      },
                    ]}
                    onPress={() => setLevelAnalyticsExportFormat("summary")}
                  >
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonTitle,
                        {
                          color:
                            levelAnalyticsExportFormat === "summary"
                              ? theme.primary
                              : theme.textColor,
                        },
                      ]}
                    >
                      Summary
                    </Text>
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      One row per level
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.levelAnalyticsFormatButton,
                      {
                        borderColor:
                          levelAnalyticsExportFormat === "detailed"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          levelAnalyticsExportFormat === "detailed"
                            ? `${theme.primary}20`
                            : "transparent",
                      },
                    ]}
                    onPress={() => setLevelAnalyticsExportFormat("detailed")}
                  >
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonTitle,
                        {
                          color:
                            levelAnalyticsExportFormat === "detailed"
                              ? theme.primary
                              : theme.textColor,
                        },
                      ]}
                    >
                      Detailed
                    </Text>
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      One row per subject
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.levelAnalyticsLevelHeader}>
                  <Text
                    style={[
                      styles.levelAnalyticsLevelTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Included Levels ({selectedLevelAnalyticsLevels.length})
                  </Text>
                  <View style={styles.levelAnalyticsQuickActions}>
                    <TouchableOpacity
                      style={[
                        styles.levelAnalyticsQuickActionButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={selectAllLevelAnalyticsLevels}
                    >
                      <Text
                        style={[
                          styles.levelAnalyticsQuickActionText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.levelAnalyticsQuickActionButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={clearLevelAnalyticsLevels}
                    >
                      <Text
                        style={[
                          styles.levelAnalyticsQuickActionText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.levelAnalyticsLevelsScroll}
                  contentContainerStyle={styles.levelAnalyticsLevelsContent}
                  showsVerticalScrollIndicator={false}
                >
                  {availableLevelAnalyticsLevels.map((level) => {
                    const isSelected =
                      selectedLevelAnalyticsLevels.includes(level);
                    return (
                      <TouchableOpacity
                        key={`level-export-${level}`}
                        style={[
                          styles.levelAnalyticsLevelRow,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() => toggleLevelAnalyticsLevelSelection(level)}
                      >
                        <Text
                          style={[
                            styles.levelAnalyticsLevelRowText,
                            { color: theme.textColor },
                          ]}
                        >
                          Level {level}
                        </Text>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={isSelected ? theme.primary : theme.textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.reminderTimeActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setShowLevelAnalyticsExportModal(false)}
                  >
                    <Text
                      style={[
                        styles.reminderTimeButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      styles.reminderTimeSaveButton,
                      {
                        backgroundColor:
                          selectedLevelAnalyticsLevels.length > 0
                            ? theme.primary
                            : theme.border,
                      },
                    ]}
                    onPress={() => {
                      void handleConfirmLevelAnalyticsExport();
                    }}
                    disabled={
                      selectedLevelAnalyticsLevels.length === 0 ||
                      isExportingLevelAnalytics
                    }
                  >
                    <Text
                      style={[styles.reminderTimeButtonText, { color: "#fff" }]}
                    >
                      Export CSV
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Android Vocabulary Voice Picker Modal */}
      {Platform.OS === "android" && (
        <Modal
          visible={showVocabularyVoiceMenu}
          transparent
          animationType="fade"
          onRequestClose={closeVocabularyAudioVoicePicker}
        >
          <TouchableWithoutFeedback onPress={closeVocabularyAudioVoicePicker}>
            <View
              style={[
                styles.voicePickerModalOverlay,
                {
                  paddingHorizontal: sheetHorizontalPadding,
                  paddingBottom: sheetBottomPadding,
                },
              ]}
            >
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.voicePickerModalContent,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text
                    style={[
                      styles.voicePickerModalTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Vocabulary Audio Voice
                  </Text>

                  {VOCABULARY_AUDIO_VOICE_OPTIONS.map((option) => {
                    const isSelected = vocabularyAudioVoice === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.voicePickerModalOption,
                          { borderTopColor: theme.border },
                        ]}
                        onPress={() => selectVocabularyAudioVoice(option.value)}
                      >
                        <Ionicons
                          name={getVocabularyAudioVoiceIconName(option.value)}
                          size={20}
                          color={theme.textColor}
                        />
                        <Text
                          style={[
                            styles.voicePickerModalOptionText,
                            { color: theme.textColor },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={theme.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.voicePickerModalOption,
                      styles.voicePickerModalCancel,
                      { borderTopColor: theme.border },
                    ]}
                    onPress={closeVocabularyAudioVoicePicker}
                  >
                    <Text
                      style={[
                        styles.voicePickerModalCancelText,
                        { color: theme.error },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Android SRS Progression Card Picker Modal */}
      {Platform.OS === "android" && (
        <Modal
          visible={showSrsProgressionCardModeMenu}
          transparent
          animationType="fade"
          onRequestClose={closeSrsProgressionCardModePicker}
        >
          <TouchableWithoutFeedback onPress={closeSrsProgressionCardModePicker}>
            <View
              style={[
                styles.voicePickerModalOverlay,
                {
                  paddingHorizontal: sheetHorizontalPadding,
                  paddingBottom: sheetBottomPadding,
                },
              ]}
            >
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.voicePickerModalContent,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text
                    style={[
                      styles.voicePickerModalTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    SRS Progression Card
                  </Text>

                  {SRS_PROGRESSION_CARD_MODE_OPTIONS.map((option) => {
                    const isSelected =
                      srsProgressionCardDisplayMode === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.voicePickerModalOption,
                          { borderTopColor: theme.border },
                        ]}
                        onPress={() => selectSrsProgressionCardMode(option.value)}
                      >
                        <Ionicons
                          name={getSrsProgressionCardModeIconName(option.value)}
                          size={20}
                          color={theme.textColor}
                        />
                        <Text
                          style={[
                            styles.voicePickerModalOptionText,
                            { color: theme.textColor },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={theme.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.voicePickerModalOption,
                      styles.voicePickerModalCancel,
                      { borderTopColor: theme.border },
                    ]}
                    onPress={closeSrsProgressionCardModePicker}
                  >
                    <Text
                      style={[
                        styles.voicePickerModalCancelText,
                        { color: theme.error },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      <Modal
        visible={showReminderTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReminderTimeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowReminderTimeModal(false)}>
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.reminderTimeModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.voicePickerModalTitle,
                    { color: theme.textColor, paddingBottom: 8 },
                  ]}
                >
                  Daily Reminder Time
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, paddingHorizontal: 16 },
                  ]}
                >
                  Shared by daily review and lesson reminders in your local timezone.
                </Text>
                <View
                  style={[
                    styles.reminderTimePickerContainer,
                    {
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.reminderTimePickerRow}>
                    <View style={styles.reminderTimePickerColumn}>
                      <Text
                        style={[
                          styles.reminderTimePickerLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Hour
                      </Text>
                      <Picker
                        selectedValue={reminderHourDraft}
                        onValueChange={(value) =>
                          setReminderHourDraft(Number(value))
                        }
                        style={[
                          styles.reminderTimeValuePicker,
                          { color: theme.textColor },
                        ]}
                        itemStyle={[
                          styles.reminderTimeValuePickerItem,
                          { color: theme.textColor },
                        ]}
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <Picker.Item
                            key={`reminder-hour-${hour}`}
                            label={hour.toString().padStart(2, "0")}
                            value={hour}
                          />
                        ))}
                      </Picker>
                    </View>
                    <View style={styles.reminderTimePickerColumn}>
                      <Text
                        style={[
                          styles.reminderTimePickerLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Minute
                      </Text>
                      <Picker
                        selectedValue={reminderMinuteDraft}
                        onValueChange={(value) =>
                          setReminderMinuteDraft(Number(value))
                        }
                        style={[
                          styles.reminderTimeValuePicker,
                          { color: theme.textColor },
                        ]}
                        itemStyle={[
                          styles.reminderTimeValuePickerItem,
                          { color: theme.textColor },
                        ]}
                      >
                        {Array.from({ length: 60 }, (_, minute) => (
                          <Picker.Item
                            key={`reminder-minute-${minute}`}
                            label={minute.toString().padStart(2, "0")}
                            value={minute}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
                <View style={styles.reminderTimeActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setShowReminderTimeModal(false)}
                  >
                    <Text
                      style={[
                        styles.reminderTimeButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      styles.reminderTimeSaveButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => void handleSaveReminderTime()}
                  >
                    <Text
                      style={[styles.reminderTimeButtonText, { color: "#fff" }]}
                    >
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showAnswerStopDetailsPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAnswerStopDetailsPreview(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowAnswerStopDetailsPreview(false)}
        >
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.answerStopPreviewCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.answerStopPreviewHeader}>
                  <View
                    style={[
                      styles.answerStopPreviewIcon,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.04)",
                      },
                    ]}
                  >
                    <Ionicons name="help" size={17} color={theme.primary} />
                  </View>
                  <Text
                    style={[
                      styles.answerStopPreviewTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Answer Pause Details
                  </Text>
                </View>

                <Text
                  style={[
                    styles.answerStopPreviewDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  When a review stops after an answer, the answer field, actions,
                  and subject details slide up together below the subject.
                </Text>

                <View
                  style={[
                    styles.answerStopPreviewScreenshotFrame,
                    {
                      backgroundColor: theme.backgroundColor,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Image
                    source={STOP_DETAILS_PREVIEW_IMAGE}
                    style={[
                      styles.answerStopPreviewScreenshot,
                      { height: answerStopPreviewImageHeight },
                    ]}
                    contentFit="contain"
                    accessibilityLabel="Preview of the answer pause details sheet"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.answerStopPreviewCloseButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setShowAnswerStopDetailsPreview(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.answerStopPreviewCloseText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showReviewShortcutModal}
        transparent
        animationType="fade"
        onRequestClose={closeReviewShortcutModal}
      >
        <TouchableWithoutFeedback onPress={closeReviewShortcutModal}>
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingTop: reviewShortcutSheetTopPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.reviewShortcutModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <ScrollView
                  style={styles.reviewShortcutModalScrollView}
                  contentContainerStyle={styles.reviewShortcutModalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={[
                      styles.voicePickerModalTitle,
                      { color: theme.textColor, paddingBottom: 8 },
                    ]}
                  >
                    Review Key Shortcuts
                  </Text>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary, paddingHorizontal: 16 },
                    ]}
                  >
                    External keyboards only. Tap a shortcut, then press one key.
                    Press Backspace to clear.
                  </Text>
                  <View
                    style={[
                      styles.reviewShortcutGroup,
                      { borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.reviewShortcutGroupHeader,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={styles.reviewShortcutGroupHeaderTextContainer}>
                        <Text
                          style={[
                            styles.reviewShortcutGroupTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          Stop on Incorrect
                        </Text>
                        <Text
                          style={[
                            styles.reviewShortcutGroupSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Active when Pause on Wrong Answer or Pause on Close
                          Answer is enabled.
                        </Text>
                      </View>
                      <Switch
                        value={disableAutoProgressOnWrong}
                        onValueChange={(enabled) => {
                          setDisableAutoProgressOnWrong(enabled);
                          if (
                            !enabled &&
                            capturingReviewShortcutKey?.group === "incorrect"
                          ) {
                            setCapturingReviewShortcutKey(null);
                          }
                        }}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </View>

                    <View
                      style={[
                        styles.reviewShortcutList,
                        !disableAutoProgressOnWrong &&
                          !disableAutoProgressOnCloseAnswer &&
                          styles.reviewShortcutListDisabled,
                      ]}
                    >
                      {REVIEW_INCORRECT_SHORTCUT_FIELDS.map((shortcutField, index) => {
                        const isCapturingThisKey =
                          capturingReviewShortcutKey?.group === "incorrect" &&
                          capturingReviewShortcutKey.key === shortcutField.key;

                        return (
                          <TouchableOpacity
                            key={`incorrect-${shortcutField.key}`}
                            activeOpacity={0.8}
                            onPress={() =>
                              beginReviewShortcutCapture({
                                group: "incorrect",
                                key: shortcutField.key,
                              })
                            }
                            disabled={
                              !disableAutoProgressOnWrong &&
                              !disableAutoProgressOnCloseAnswer
                            }
                            style={[
                              styles.reviewShortcutRow,
                              index > 0 && {
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: theme.border,
                              },
                            ]}
                          >
                            <View style={styles.reviewShortcutTextContainer}>
                              <Text
                                style={[
                                  styles.reviewShortcutLabel,
                                  { color: theme.textColor },
                                ]}
                              >
                                {shortcutField.label}
                              </Text>
                              <Text
                                style={[
                                  styles.reviewShortcutHint,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {shortcutField.hint}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.reviewShortcutValueButton,
                                {
                                  borderColor: theme.border,
                                  backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                                },
                                isCapturingThisKey && { borderColor: theme.primary },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.reviewShortcutValueText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {isCapturingThisKey
                                  ? "Press key"
                                  : formatReviewShortcutLabel(
                                      reviewIncorrectShortcutDraft[shortcutField.key],
                                    )}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.reviewShortcutGroup,
                      { borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.reviewShortcutGroupHeader,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View style={styles.reviewShortcutGroupHeaderTextContainer}>
                        <Text
                          style={[
                            styles.reviewShortcutGroupTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          Stop on Correct
                        </Text>
                        <Text
                          style={[
                            styles.reviewShortcutGroupSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Active when Pause on Correct Answer is enabled.
                        </Text>
                      </View>
                      <Switch
                        value={disableAutoProgressOnCorrect}
                        onValueChange={(enabled) => {
                          setDisableAutoProgressOnCorrect(enabled);
                          if (
                            !enabled &&
                            capturingReviewShortcutKey?.group === "correct"
                          ) {
                            setCapturingReviewShortcutKey(null);
                          }
                        }}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </View>

                    <View
                      style={[
                        styles.reviewShortcutList,
                        !disableAutoProgressOnCorrect && styles.reviewShortcutListDisabled,
                      ]}
                    >
                      {REVIEW_CORRECT_SHORTCUT_FIELDS.map((shortcutField, index) => {
                        const isCapturingThisKey =
                          capturingReviewShortcutKey?.group === "correct" &&
                          capturingReviewShortcutKey.key === shortcutField.key;

                        return (
                          <TouchableOpacity
                            key={`correct-${shortcutField.key}`}
                            activeOpacity={0.8}
                            onPress={() =>
                              beginReviewShortcutCapture({
                                group: "correct",
                                key: shortcutField.key,
                              })
                            }
                            disabled={!disableAutoProgressOnCorrect}
                            style={[
                              styles.reviewShortcutRow,
                              index > 0 && {
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: theme.border,
                              },
                            ]}
                          >
                            <View style={styles.reviewShortcutTextContainer}>
                              <Text
                                style={[
                                  styles.reviewShortcutLabel,
                                  { color: theme.textColor },
                                ]}
                              >
                                {shortcutField.label}
                              </Text>
                              <Text
                                style={[
                                  styles.reviewShortcutHint,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {shortcutField.hint}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.reviewShortcutValueButton,
                                {
                                  borderColor: theme.border,
                                  backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                                },
                                isCapturingThisKey && { borderColor: theme.primary },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.reviewShortcutValueText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {isCapturingThisKey
                                  ? "Press key"
                                  : formatReviewShortcutLabel(
                                      reviewCorrectShortcutDraft[shortcutField.key],
                                    )}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.reminderTimeActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.reminderTimeButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={closeReviewShortcutModal}
                    >
                      <Text
                        style={[
                          styles.reminderTimeButtonText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <TextInput
                  ref={reviewShortcutCaptureInputRef}
                  value=""
                  onChangeText={() => {}}
                  onKeyPress={handleReviewShortcutCaptureKeyPress}
                  onSubmitEditing={handleReviewShortcutCaptureSubmit}
                  style={styles.hiddenShortcutCaptureInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                  returnKeyType="done"
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {showBunproSurvey && (
        <Modal
          visible={showBunproSurveyModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (isSubmittingBunproSurvey) {
              return;
            }
            setShowBunproSurveyModal(false);
          }}
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: theme.cardBackground,
                  borderBottomColor: theme.border,
                  paddingTop: modalHeaderPaddingTop,
                },
              ]}
            >
              <TouchableOpacity
                disabled={isSubmittingBunproSurvey}
                onPress={() => setShowBunproSurveyModal(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    {
                      color: theme.primary,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Bunpro Survey
              </Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              contentContainerStyle={styles.bunproSurveyModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Super short. This helps prioritize Bunpro support in the app.
              </Text>

              <Text
                style={[
                  styles.bunproSurveyQuestion,
                  { color: theme.textColor, marginTop: 16 },
                ]}
              >
                Do you use Bunpro?
              </Text>

              <View style={styles.bunproSurveyButtonRow}>
                <TouchableOpacity
                  style={[
                    styles.bunproSurveyChoiceButton,
                    {
                      backgroundColor:
                        bunproUsageAnswer === "yes"
                          ? theme.primary
                          : theme.backgroundColor,
                      borderColor:
                        bunproUsageAnswer === "yes" ? theme.primary : theme.border,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleBunproUsageSelection("yes");
                  }}
                >
                  <Text
                    style={[
                      styles.bunproSurveyChoiceButtonText,
                      {
                        color:
                          bunproUsageAnswer === "yes"
                            ? "#FFFFFF"
                            : theme.textColor,
                      },
                    ]}
                  >
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bunproSurveyChoiceButton,
                    {
                      backgroundColor:
                        bunproUsageAnswer === "no"
                          ? theme.primary
                          : theme.backgroundColor,
                      borderColor:
                        bunproUsageAnswer === "no" ? theme.primary : theme.border,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleBunproUsageSelection("no");
                  }}
                >
                  <Text
                    style={[
                      styles.bunproSurveyChoiceButtonText,
                      {
                        color:
                          bunproUsageAnswer === "no"
                            ? "#FFFFFF"
                            : theme.textColor,
                      },
                    ]}
                  >
                    No
                  </Text>
                </TouchableOpacity>
              </View>

              {bunproUsageAnswer === "yes" && (
                <View style={styles.bunproSurveyFollowUpContainer}>
                  <Text
                    style={[
                      styles.bunproSurveyQuestion,
                      { color: theme.textColor, marginBottom: 8 },
                    ]}
                  >
                    Would you want Bunpro inside this app too?
                  </Text>

                  <View style={styles.bunproSurveyButtonRow}>
                    <TouchableOpacity
                      style={[
                        styles.bunproSurveyChoiceButton,
                        {
                          backgroundColor:
                            bunproIntegrationAnswer === "yes"
                              ? theme.primary
                              : theme.backgroundColor,
                          borderColor:
                            bunproIntegrationAnswer === "yes"
                              ? theme.primary
                              : theme.border,
                          opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                        },
                      ]}
                      disabled={isSubmittingBunproSurvey}
                      onPress={() => setBunproIntegrationAnswer("yes")}
                    >
                      <Text
                        style={[
                          styles.bunproSurveyChoiceButtonText,
                          {
                            color:
                              bunproIntegrationAnswer === "yes"
                                ? "#FFFFFF"
                                : theme.textColor,
                          },
                        ]}
                      >
                        Yes
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.bunproSurveyChoiceButton,
                        {
                          backgroundColor:
                            bunproIntegrationAnswer === "no"
                              ? theme.primary
                              : theme.backgroundColor,
                          borderColor:
                            bunproIntegrationAnswer === "no"
                              ? theme.primary
                              : theme.border,
                          opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                        },
                      ]}
                      disabled={isSubmittingBunproSurvey}
                      onPress={() => setBunproIntegrationAnswer("no")}
                    >
                      <Text
                        style={[
                          styles.bunproSurveyChoiceButtonText,
                          {
                            color:
                              bunproIntegrationAnswer === "no"
                                ? "#FFFFFF"
                                : theme.textColor,
                          },
                        ]}
                      >
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    value={bunproFeatureRequestInput}
                    onChangeText={setBunproFeatureRequestInput}
                    editable={!isSubmittingBunproSurvey}
                    multiline
                    numberOfLines={3}
                    placeholder="Optional: What Bunpro features would you like here?"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.bunproSurveyInput,
                      {
                        color: theme.textColor,
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundColor,
                      },
                    ]}
                  />

                  <TouchableOpacity
                    style={[
                      styles.bunproSurveySubmitButton,
                      {
                        backgroundColor: theme.primary,
                        opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                      },
                    ]}
                    disabled={isSubmittingBunproSurvey}
                    onPress={() => {
                      void handleSubmitBunproSurvey();
                    }}
                  >
                    <Text style={styles.bunproSurveySubmitButtonText}>
                      {isSubmittingBunproSurvey ? "Saving..." : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {bunproUsageAnswer === "no" && (
                <TouchableOpacity
                  style={[
                    styles.bunproSurveySubmitButton,
                    {
                      backgroundColor: theme.primary,
                      opacity: isSubmittingBunproSurvey ? 0.65 : 1,
                      marginTop: 14,
                    },
                  ]}
                  disabled={isSubmittingBunproSurvey}
                  onPress={() => {
                    void handleSubmitBunproSurvey();
                  }}
                >
                  <Text style={styles.bunproSurveySubmitButtonText}>
                    {isSubmittingBunproSurvey ? "Saving..." : "Submit"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Voice Selection Modal */}
      <Modal
        visible={showVoiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.cardBackground,
                borderBottomColor: theme.border,
                paddingTop: modalHeaderPaddingTop,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              Select Voice
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {JAPANESE_VOICES.map((voice) => (
              <View
                key={voice.shortName}
                style={[
                  styles.voiceOption,
                  {
                    backgroundColor: theme.cardBackground,
                    borderBottomColor: theme.border,
                  },
                  selectedVoice === voice.shortName && {
                    backgroundColor: theme.primary + "20",
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.voiceMainArea}
                  onPress={() => saveSelectedVoice(voice.shortName)}
                >
                  <View style={styles.voiceInfo}>
                    <Text
                      style={[styles.voiceName, { color: theme.textColor }]}
                    >
                      {voice.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.voiceDetails,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {voice.localName} • {voice.gender}
                    </Text>
                  </View>
                  {selectedVoice === voice.shortName && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testVoiceButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={() => testVoice(voice.shortName)}
                >
                  <Ionicons
                    name={
                      testingVoiceId === voice.shortName
                        ? "time"
                        : "volume-high"
                    }
                    size={20}
                    color={
                      testingVoiceId === voice.shortName
                        ? theme.textSecondary
                        : theme.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Cache Analysis Modal */}
      <Modal
        visible={showCacheModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.cardBackground,
                borderBottomColor: theme.border,
                paddingTop: modalHeaderPaddingTop,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowCacheModal(false)}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Close
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              Cache Analysis
            </Text>
            <TouchableOpacity onPress={handleCacheAnalysis}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Refresh
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {cacheAnalysis && (
              <>
                {/* Summary */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Summary
                  </Text>
                  <View style={styles.cacheRow}>
                    <Text
                      style={[styles.cacheLabel, { color: theme.textColor }]}
                    >
                      Total Size:
                    </Text>
                    <Text
                      style={[
                        styles.cacheValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {cacheAnalysis.totalSizeFormatted}
                    </Text>
                  </View>
                  <View style={styles.cacheRow}>
                    <Text
                      style={[styles.cacheLabel, { color: theme.textColor }]}
                    >
                      Total Items:
                    </Text>
                    <Text
                      style={[
                        styles.cacheValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {cacheAnalysis.itemCount}
                    </Text>
                  </View>
                </View>

                {/* Quick Actions */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Quick Actions
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.cacheActionButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={handleClearLargeItems}
                  >
                    <Ionicons name="trash" size={20} color="#e53935" />
                    <Text
                      style={[styles.cacheActionText, { color: "#e53935" }]}
                    >
                      Clear Large Items ({">"}5MB)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.cacheActionButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={handleDetailedSubjectsAnalysis}
                  >
                    <Ionicons
                      name="analytics"
                      size={20}
                      color={theme.primary}
                    />
                    <Text
                      style={[styles.cacheActionText, { color: theme.primary }]}
                    >
                      Analyze Subjects Cache
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Categories */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    By Category
                  </Text>
                  {Object.entries(cacheAnalysis.categories)
                    .sort(([, a], [, b]) => b.size - a.size)
                    .map(([category, data]) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryItem,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() => handleClearCategory(category)}
                      >
                        <View style={styles.categoryInfo}>
                          <Text
                            style={[
                              styles.categoryName,
                              { color: theme.textColor },
                            ]}
                          >
                            {category}
                          </Text>
                          <Text
                            style={[
                              styles.categoryDetails,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {data.sizeFormatted} • {data.count} items
                          </Text>
                        </View>
                        <Ionicons
                          name="trash"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                </View>

                {/* Largest Items */}
                <View
                  style={[
                    styles.cacheSection,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheSectionTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Largest Items
                  </Text>
                  {cacheAnalysis.largestItems
                    .slice(0, 10)
                    .map((item, index) => (
                      <View
                        key={item.key}
                        style={[
                          styles.largestItem,
                          { borderBottomColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.largestItemRank,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {index + 1}.
                        </Text>
                        <View style={styles.largestItemInfo}>
                          <Text
                            style={[
                              styles.largestItemKey,
                              { color: theme.textColor },
                            ]}
                            numberOfLines={1}
                          >
                            {item.key}
                          </Text>
                          <Text
                            style={[
                              styles.largestItemDetails,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {item.sizeFormatted} • {item.category}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Notifications Debug Modal - Dev Only */}
      {__DEV__ && (
        <Modal
          visible={showNotificationsModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: theme.cardBackground,
                  borderBottomColor: theme.border,
                  paddingTop: modalHeaderPaddingTop,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowNotificationsModal(false)}
              >
                <Text
                  style={[styles.modalCancelText, { color: theme.primary }]}
                >
                  Close
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Scheduled Notifications
              </Text>
              <TouchableOpacity onPress={handleShowPendingNotifications}>
                <Text
                  style={[styles.modalCancelText, { color: theme.primary }]}
                >
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {pendingNotifications && (
                <>
                  {/* Summary */}
                  <View
                    style={[
                      styles.cacheSection,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cacheSectionTitle,
                        { color: theme.textColor },
                      ]}
                    >
                      Summary
                    </Text>
                    <View style={styles.cacheRow}>
                      <Text
                        style={[styles.cacheLabel, { color: theme.textColor }]}
                      >
                        Total Notifications:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {pendingNotifications.count +
                          expoPendingNotifications.length}
                      </Text>
                    </View>
                    <View style={styles.cacheRow}>
                      <Text
                        style={[styles.cacheLabel, { color: theme.textColor }]}
                      >
                        Native Scheduled:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {pendingNotifications.count}
                      </Text>
                    </View>
                    <View style={styles.cacheRow}>
                      <Text
                        style={[styles.cacheLabel, { color: theme.textColor }]}
                      >
                        Expo Scheduled:
                      </Text>
                      <Text
                        style={[
                          styles.cacheValue,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {expoPendingNotifications.length}
                      </Text>
                    </View>
                  </View>

                  {/* Native Notifications List */}
                  {pendingNotifications.notifications.length > 0 && (
                    <View
                      style={[
                        styles.cacheSection,
                        {
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cacheSectionTitle,
                          { color: theme.textColor },
                        ]}
                      >
                        Native Scheduled Notifications
                      </Text>
                      {pendingNotifications.notifications.map(
                        (notification, index) => (
                          <View
                            key={notification.identifier}
                            style={[
                              styles.largestItem,
                              { borderBottomColor: theme.border },
                            ]}
                          >
                            <Text
                              style={[
                                styles.largestItemRank,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {index + 1}.
                            </Text>
                            <View style={styles.largestItemInfo}>
                              <Text
                                style={[
                                  styles.largestItemKey,
                                  { color: theme.textColor },
                                ]}
                                numberOfLines={1}
                              >
                                {notification.title || notification.identifier}
                              </Text>
                              <Text
                                style={[
                                  styles.largestItemDetails,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Badge: {notification.badge} •{" "}
                                {formatNativeTriggerLabel(notification.trigger)}
                              </Text>
                              <Text
                                style={[
                                  styles.largestItemDetails,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {notification.body}
                              </Text>
                            </View>
                          </View>
                        ),
                      )}
                    </View>
                  )}

                  {/* Expo Notifications List */}
                  {expoPendingNotifications.length > 0 && (
                    <View
                      style={[
                        styles.cacheSection,
                        {
                          backgroundColor: theme.cardBackground,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cacheSectionTitle,
                          { color: theme.textColor },
                        ]}
                      >
                        Expo Scheduled Notifications
                      </Text>
                      {expoPendingNotifications.map((notification, index) => (
                        <View
                          key={notification.identifier}
                          style={[
                            styles.largestItem,
                            { borderBottomColor: theme.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.largestItemRank,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {index + 1}.
                          </Text>
                          <View style={styles.largestItemInfo}>
                            <Text
                              style={[
                                styles.largestItemKey,
                                { color: theme.textColor },
                              ]}
                              numberOfLines={1}
                            >
                              {notification.content.title ||
                                notification.identifier}
                            </Text>
                            <Text
                              style={[
                                styles.largestItemDetails,
                                { color: theme.textSecondary },
                              ]}
                            >
                              Trigger:{" "}
                              {formatExpoTriggerLabel(notification.trigger)}
                            </Text>
                            <Text
                              style={[
                                styles.largestItemDetails,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {notification.content.body || "No body"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Empty state */}
                  {pendingNotifications.notifications.length === 0 &&
                    expoPendingNotifications.length === 0 && (
                      <View
                        style={[
                          styles.cacheSection,
                          {
                            backgroundColor: theme.cardBackground,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cacheSectionTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          No Scheduled Notifications
                        </Text>
                        <Text
                          style={[
                            styles.cacheLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          No notifications are currently scheduled. Enable
                          notification settings to schedule review notifications.
                        </Text>
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Performance Dashboard - Dev Only */}
      {__DEV__ && (
        <PerformanceDashboard
          visible={showPerformanceDashboard}
          onClose={() => setShowPerformanceDashboard(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  sectionChipBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionChipContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingItemColumn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
  },
  settingHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingInfoButton: {
    padding: 2,
  },
  settingTrailingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingHelpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  settingSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  bunproSurveyModalContent: {
    paddingBottom: 24,
  },
  bunproSurveyQuestion: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  bunproSurveyButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  bunproSurveyChoiceButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  bunproSurveyChoiceButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bunproSurveyFollowUpContainer: {
    marginTop: 14,
  },
  bunproSurveyInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 92,
    textAlignVertical: "top",
    fontSize: 14,
  },
  bunproSurveySubmitButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  bunproSurveySubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  settingValueText: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: "#e53935",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 8,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  betaBadge: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  betaBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderRadius: 8,
    marginVertical: 4,
    overflow: "hidden",
  },
  voiceMainArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: "500",
  },
  voiceDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  testVoiceButton: {
    padding: 12,
    borderLeftWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cacheSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  cacheSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  cacheRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cacheLabel: {
    fontSize: 16,
  },
  cacheValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cacheActionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  cacheActionText: {
    fontSize: 16,
    marginLeft: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  categoryDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  largestItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  largestItemRank: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  largestItemInfo: {
    flex: 1,
  },
  largestItemKey: {
    fontSize: 16,
    fontWeight: "bold",
  },
  largestItemDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 8,
  },
  syncControls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  syncButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncStatusText: {
    fontSize: 14,
    marginTop: 8,
  },
  playbackSelector: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  playbackSourceButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playbackSourceButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  musicLoginActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  voiceSelectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  voiceSelectionHost: {
    borderRadius: 8,
  },
  voiceSelectionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voiceSelectionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  offlineAudioDeleteRow: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  offlineAudioDeleteIconButton: {
    borderWidth: 1,
    borderRadius: 8,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewCard: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  answerStopPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  answerStopPreviewIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  answerStopPreviewDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  answerStopPreviewScreenshotFrame: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    paddingVertical: 8,
  },
  answerStopPreviewScreenshot: {
    aspectRatio: STOP_DETAILS_PREVIEW_ASPECT_RATIO,
    borderRadius: 8,
  },
  answerStopPreviewCloseButton: {
    borderRadius: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewCloseText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  voicePickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  voicePickerModalContent: {
    borderRadius: 14,
    overflow: "hidden",
  },
  reminderTimeModalContent: {
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 16,
  },
  levelAnalyticsExportModalContent: {
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 16,
  },
  levelAnalyticsFormatRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  levelAnalyticsFormatButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  levelAnalyticsFormatButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  levelAnalyticsFormatButtonSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  levelAnalyticsLevelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  levelAnalyticsLevelTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelAnalyticsQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelAnalyticsQuickActionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelAnalyticsQuickActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  levelAnalyticsLevelsScroll: {
    marginTop: 10,
    maxHeight: 280,
  },
  levelAnalyticsLevelsContent: {
    paddingBottom: 4,
  },
  levelAnalyticsLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  levelAnalyticsLevelRowText: {
    fontSize: 15,
    fontWeight: "500",
  },
  reviewShortcutModalContent: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 55,
    borderBottomRightRadius: 55,
    maxHeight: "100%",
    overflow: "hidden",
  },
  reviewShortcutModalScrollView: {
    maxHeight: "100%",
  },
  reviewShortcutModalScrollContent: {
    paddingBottom: 12,
  },
  reviewShortcutGroup: {
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
  },
  reviewShortcutGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewShortcutGroupHeaderTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  reviewShortcutGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewShortcutGroupSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewShortcutList: {
    overflow: "hidden",
  },
  reviewShortcutListDisabled: {
    opacity: 0.45,
  },
  reviewShortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewShortcutTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  reviewShortcutLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewShortcutHint: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewShortcutValueButton: {
    width: 78,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewShortcutValueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  hiddenShortcutCaptureInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  reminderTimePickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  reminderTimePickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  reminderTimePickerColumn: {
    flex: 1,
  },
  reminderTimePickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  reminderTimeValuePicker: {
    height: 180,
  },
  reminderTimeValuePickerItem: {
    fontSize: 20,
  },
  reminderTimeActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 16,
  },
  reminderTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginBottom: 12,
  },
  reminderTimeSaveButton: {
    borderWidth: 0,
  },
  reminderTimeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  voicePickerModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  voicePickerModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  voicePickerModalOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  voicePickerModalCancel: {
    justifyContent: "center",
  },
  voicePickerModalCancelText: {
    width: "100%",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  inputIconButton: {
    width: 44,
    height: 44,
    marginLeft: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  batchSizeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchSizeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  batchSizeButtonDisabled: {
    opacity: 0.5,
  },
  batchSizeValue: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  reviewCharacterSizeValue: {
    minWidth: 42,
  },
  leniencyValue: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 80,
    textAlign: "center",
  },
  themeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  themeSelectorButton: {
    flexGrow: 1,
    flexBasis: "31%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  themeSelectorText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
