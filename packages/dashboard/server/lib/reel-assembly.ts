/**
 * Storytelling Reel Assembly — FFmpeg pipeline.
 *
 * Stitches per-shot video clips with a continuous voiceover MP3, optional music bed (ducked
 * under VO via sidechain compression), and burnt-in SRT captions. Output is a final
 * `data/reels/<reelId>/final.mp4` ready for direct upload to Reels / Shorts / TikTok.
 *
 * Also exports a bundle builder that writes a `.zip` with separate clips, voice stem, music
 * stem, captions, and a README — so the user can drop the parts into CapCut for fine cuts.
 */
import fs from "fs";
import path from "path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
// archiver 8 is ESM-only and exports class constructors; @types/archiver still describes the
// legacy factory function. Cast the module shape so runtime ZipArchive is callable.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - @types/archiver mismatch with archiver 8 ESM exports
import { ZipArchive } from "archiver";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export type AssemblyShot = {
  index: number;
  videoUrl: string;    // remote (CloudFront) URL — will be downloaded into reelDir
  startSec: number;
  endSec: number;
};

export type AssembleParams = {
  reelId: string;
  reelDir: string;       // absolute path to data/reels/<reelId>/
  shots: AssemblyShot[];
  voiceoverPath: string;
  musicPath?: string | null;
  captionsSrt: string;
  durationSec: number;
};

export async function assembleReel(params: AssembleParams): Promise<{ outputPath: string; publicUrl: string; durationSec: number }> {
  const { reelId, reelDir, shots, voiceoverPath, musicPath, captionsSrt, durationSec } = params;
  fs.mkdirSync(reelDir, { recursive: true });

  // 1. Download all shot clips locally so FFmpeg can concat them
  const clipsDir = path.join(reelDir, "clips");
  fs.mkdirSync(clipsDir, { recursive: true });
  const localClipPaths: string[] = [];
  for (const shot of shots) {
    if (!shot.videoUrl) continue;
    const localPath = path.join(clipsDir, `shot-${String(shot.index).padStart(2, "0")}.mp4`);
    if (!fs.existsSync(localPath)) {
      await downloadToFile(shot.videoUrl, localPath);
    }
    localClipPaths.push(localPath);
  }
  if (localClipPaths.length === 0) {
    throw new Error("assembleReel: no shot videos available to stitch");
  }

  // 2. Write SRT captions to disk
  const srtPath = path.join(reelDir, "captions.srt");
  fs.writeFileSync(srtPath, captionsSrt || "", "utf-8");

  // 3. Build concat demuxer list
  const concatListPath = path.join(reelDir, "concat-list.txt");
  fs.writeFileSync(
    concatListPath,
    localClipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    "utf-8",
  );

  const outputPath = path.join(reelDir, "final.mp4");

  // 4. Stitch via raw FFmpeg invocation (fluent-ffmpeg can't easily express sidechain compression
  // + subtitles filter + multiple inputs together, so we shell out directly).
  const ffmpegBin = ffmpegStatic || "ffmpeg";
  const args: string[] = [
    "-y",
    // Input 0: video concat (no audio — we replace with VO)
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
    // Input 1: voiceover
    "-i", voiceoverPath,
  ];
  let videoFilter = "";
  let audioFilter: string;
  if (musicPath && fs.existsSync(musicPath)) {
    args.push("-i", musicPath);
    // Duck music under VO via sidechain compression
    audioFilter =
      "[2:a]volume=0.32[music_low];" +
      "[music_low][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[ducked];" +
      "[ducked][1:a]amix=inputs=2:duration=first:weights=1 1[aout]";
  } else {
    audioFilter = "[1:a]volume=1.0[aout]";
  }

  // Burn captions (use posix path; SRT filter is finicky with special chars on macOS)
  // We escape the colon in the filter argument and quote the filename.
  const srtEscaped = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
  videoFilter = `[0:v]subtitles='${srtEscaped}':force_style='Fontname=Helvetica Neue,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=80'[vout]`;

  const filterComplex = `${videoFilter};${audioFilter}`;
  args.push(
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-map", "[aout]",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "192k",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-shortest",
    outputPath,
  );

  await runFfmpeg(ffmpegBin, args);

  if (!fs.existsSync(outputPath)) {
    throw new Error("assembleReel: FFmpeg completed but no output file produced");
  }

  return {
    outputPath,
    publicUrl: `/reels/${reelId}/final.mp4`,
    durationSec,
  };
}

export async function buildReelBundle(params: {
  reelId: string;
  reelDir: string;
  voiceoverPath: string;
  musicPath?: string | null;
  finalMp4Path?: string | null;
  captionsSrt: string;
  manifestJson: unknown;
  readmeMarkdown: string;
}): Promise<{ zipPath: string; publicUrl: string }> {
  const { reelId, reelDir } = params;
  fs.mkdirSync(reelDir, { recursive: true });
  const zipPath = path.join(reelDir, "bundle.zip");

  // Persist captions + manifest + README into the bundle source
  fs.writeFileSync(path.join(reelDir, "captions.srt"), params.captionsSrt || "");
  fs.writeFileSync(path.join(reelDir, "manifest.json"), JSON.stringify(params.manifestJson, null, 2));
  fs.writeFileSync(path.join(reelDir, "README.md"), params.readmeMarkdown);

  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const done = new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    archive.on("error", reject);
  });

  archive.pipe(output);
  archive.directory(path.join(reelDir, "clips"), "clips");
  archive.file(params.voiceoverPath, { name: "voiceover.mp3" });
  if (params.musicPath && fs.existsSync(params.musicPath)) archive.file(params.musicPath, { name: "music.mp3" });
  if (params.finalMp4Path && fs.existsSync(params.finalMp4Path)) archive.file(params.finalMp4Path, { name: "final.mp4" });
  archive.file(path.join(reelDir, "captions.srt"), { name: "captions.srt" });
  archive.file(path.join(reelDir, "manifest.json"), { name: "manifest.json" });
  archive.file(path.join(reelDir, "README.md"), { name: "README.md" });
  await archive.finalize();
  await done;

  return { zipPath, publicUrl: `/reels/${reelId}/bundle.zip` };
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed ${response.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(dest));
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-1500)}`));
    });
  });
}
