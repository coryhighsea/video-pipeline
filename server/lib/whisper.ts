import path from "path";
import fs from "fs";
import { installWhisperCpp, downloadWhisperModel } from "@remotion/install-whisper-cpp";

const WHISPER_DIR = path.join(import.meta.dir, "..", "..", "whisper-vol", "whisper.cpp");

export const WHISPER_MODEL = "small.en" as const;
export const WHISPER_VERSION = "1.5.5" as const;
export { WHISPER_DIR };

let ensured = false;

export async function ensureWhisper(): Promise<void> {
  if (ensured) return;

  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_DIR });

  // Remove any old model files (e.g. ggml-medium.en.bin left over from a model switch)
  const expectedModel = `ggml-${WHISPER_MODEL}.bin`;
  if (fs.existsSync(WHISPER_DIR)) {
    for (const file of fs.readdirSync(WHISPER_DIR)) {
      if (file.startsWith("ggml-") && file.endsWith(".bin") && file !== expectedModel) {
        fs.unlinkSync(path.join(WHISPER_DIR, file));
        console.log(`[whisper] Removed old model: ${file}`);
      }
    }
  }

  ensured = true;
}
