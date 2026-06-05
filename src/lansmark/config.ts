export const LANSMARK_CONFIG = {
  freeCandidateLimit: Number(process.env.LANSMARK_FREE_CANDIDATE_LIMIT ?? 5),
  simulatorEnabled: process.env.LANSMARK_SIMULATOR_ENABLED !== "false",

  soil: {
    uploadEnabled: process.env.SOIL_UPLOAD_ENABLED !== "false",
    manualInputEnabled: process.env.SOIL_MANUAL_INPUT_ENABLED !== "false",
    toramCommercialPermission: process.env.TORAM_COMMERCIAL_PERMISSION === "true",
    toramApiCallEnabled: process.env.TORAM_API_CALL_ENABLED === "true",
    toramResultImportEnabled: process.env.TORAM_RESULT_IMPORT_ENABLED === "true",
  },
} as const;
