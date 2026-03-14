import path from "path";
import fs from "fs";
import { installWhisperCpp, downloadWhisperModel } from "@remotion/install-whisper-cpp";

const WHISPER_DIR = path.join(import.meta.dir, "..", "..", "whisper.cpp");

export const WHISPER_MODEL = "medium.en" as const;
export const WHISPER_VERSION = "1.5.5" as const;
export { WHISPER_DIR };

let ensured = false;

export async function ensureWhisper(): Promise<void> {
  if (ensured) return;

  // Docker volume creates an empty directory on first run. installWhisperCpp throws
  // if the directory exists without the compiled executable — clear it so it can install fresh.
  const execPath = path.join(WHISPER_DIR, "main");
  if (fs.existsSync(WHISPER_DIR) && !fs.existsSync(execPath)) {
    for (const entry of fs.readdirSync(WHISPER_DIR)) {
      fs.rmSync(path.join(WHISPER_DIR, entry), { recursive: true, force: true });
    }
  }

  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: WHISPER_MODEL, folder: WHISPER_DIR });
  ensured = true;
}
