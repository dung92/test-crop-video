import React, { useRef, useState, useEffect } from "react";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { Rnd } from "react-rnd";

const ffmpeg = createFFmpeg({
  log: true,
  corePath: "/ffmpeg/ffmpeg-core.js", // đặt trong public/ffmpeg/
});

export default function VideoThumbnails() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<File | null>(null);

  // Load ffmpeg
  useEffect(() => {
    const load = async () => {
      if (!ffmpeg.isLoaded()) {
        console.log("Loading FFmpeg...");
        await ffmpeg.load();
        console.log("FFmpeg loaded ✅");
        setReady(true);
      }
    };
    load();
  }, []);

  // Khi load video -> tạo vùng crop mặc định
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const w = videoRef.current.videoWidth;
    const h = videoRef.current.videoHeight;

    // crop mặc định 50% giữa video
    setCrop({
      x: w / 4,
      y: h / 4,
      w: w / 2,
      h: h / 2,
    });

    generateThumbnails();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      fileRef.current = file;
      setVideoSrc(URL.createObjectURL(file));
      setThumbnails([]);
      setStartTime(null);
      setEndTime(null);
      setCroppedUrl(null);
    }
  };

  const generateThumbnails = async () => {
    if (!ready || !fileRef.current || !videoRef.current) return;

    const file = fileRef.current;
    const dur = videoRef.current.duration;
    setDuration(dur);

    const frames: string[] = [];
    const count = 10;
    const interval = dur / count;

    ffmpeg.FS("writeFile", "input.mp4", await fetchFile(file));

    for (let i = 0; i < count; i++) {
      const timestamp = i * interval;
      const output = `frame_${i}.jpg`;

      await ffmpeg.run("-ss", String(timestamp), "-i", "input.mp4", "-frames:v", "1", output);

      const data = ffmpeg.FS("readFile", output);
      const url = URL.createObjectURL(new Blob([data.buffer], { type: "image/jpeg" }));
      frames.push(url);
    }

    setThumbnails(frames);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    handleSeek(time);
  };

  const handleSelectFrame = (time: number) => {
    if (startTime === null || (startTime !== null && endTime !== null)) {
      setStartTime(time);
      setEndTime(null);
    } else if (startTime !== null && endTime === null) {
      if (time > startTime) {
        setEndTime(time);
      } else {
        setEndTime(startTime);
        setStartTime(time);
      }
    }
  };

  const handleCrop = async () => {
    if (!fileRef.current) return;
    if (startTime == null || endTime == null) {
      console.error("Start time hoặc End time chưa được chọn");
      return;
    }
    if (!crop) {
      console.error("Chưa có vùng crop");
      return;
    }

    setProcessing(true);
    setCroppedUrl(null);

    const file = fileRef.current;
    ffmpeg.FS("writeFile", "input.mp4", await fetchFile(file));

    const args: string[] = [
      "-ss", startTime.toFixed(2),
      "-to", endTime.toFixed(2),
      "-i", "input.mp4",
      "-vf",
      `crop=${Math.round(crop.w)}:${Math.round(crop.h)}:${Math.round(crop.x)}:${Math.round(crop.y)}`,
      "-c:v", "libx264",
      "-c:a", "copy",
      "output.mp4"
    ];

    console.log("FFmpeg args:", args.join(" "));

    await ffmpeg.run(...args);

    const data = ffmpeg.FS("readFile", "output.mp4");
    const url = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
    setCroppedUrl(url);
    setProcessing(false);
  };

  const getNearestIndex = () => {
    if (thumbnails.length === 0) return -1;
    const interval = duration / thumbnails.length;
    let nearest = 0;
    thumbnails.forEach((_, idx) => {
      const t = idx * interval;
      if (Math.abs(t - currentTime) < Math.abs(nearest * interval - currentTime)) {
        nearest = idx;
      }
    });
    return nearest;
  };

  const nearestIndex = getNearestIndex();

  return (
    <div style={{ padding: 20 }}>
      <h2>🎬 Video Crop Demo</h2>
      <input type="file" accept="video/*" onChange={handleFileChange} />

      {!ready && <p>⏳ Loading ffmpeg...</p>}

      {videoSrc && (
        <>
          <div style={{ position: "relative", display: "inline-block" }}>
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              width={600}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
            />

            {/* Crop box draggable + resizable */}
            {crop && (
              <Rnd
                bounds="parent"
                size={{ width: crop.w, height: crop.h }}
                position={{ x: crop.x, y: crop.y }}
                onDragStop={(e, d) => {
                  setCrop({ ...crop, x: d.x, y: d.y });
                }}
                onResizeStop={(e, direction, ref, delta, position) => {
                  setCrop({
                    x: position.x,
                    y: position.y,
                    w: parseFloat(ref.style.width),
                    h: parseFloat(ref.style.height),
                  });
                }}
                style={{
                  border: "2px solid red",
                  background: "rgba(255,0,0,0.2)",
                }}
              />
            )}
          </div>

          {/* Input chỉnh crop box */}
          {crop && (
            <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
              <label>
                X:{" "}
                <input
                  type="number"
                  value={Math.round(crop.x)}
                  onChange={(e) => setCrop({ ...crop, x: parseInt(e.target.value) || 0 })}
                />
              </label>
              <label>
                Y:{" "}
                <input
                  type="number"
                  value={Math.round(crop.y)}
                  onChange={(e) => setCrop({ ...crop, y: parseInt(e.target.value) || 0 })}
                />
              </label>
              <label>
                W:{" "}
                <input
                  type="number"
                  value={Math.round(crop.w)}
                  onChange={(e) => setCrop({ ...crop, w: parseInt(e.target.value) || 100 })}
                />
              </label>
              <label>
                H:{" "}
                <input
                  type="number"
                  value={Math.round(crop.h)}
                  onChange={(e) => setCrop({ ...crop, h: parseInt(e.target.value) || 100 })}
                />
              </label>
            </div>
          )}

          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={currentTime}
            onChange={handleSliderChange}
            style={{ width: "600px", marginTop: 10 }}
          />

          {/* Frames thumbnail */}
          <div
            style={{
              display: "flex",
              marginTop: 20,
              gap: 8,
              overflowX: "auto",
              width: "600px",
              border: "1px solid #ccc",
              padding: 5,
              background: "#222",
            }}
          >
            {thumbnails.map((thumb, idx) => {
              const interval = duration / thumbnails.length;
              const time = idx * interval;

              const isActive = idx === nearestIndex;
              const isSelected =
                (startTime !== null && Math.abs(startTime - time) < interval / 2) ||
                (endTime !== null && Math.abs(endTime - time) < interval / 2);

              return (
                <img
                  key={idx}
                  src={thumb}
                  alt={`thumb-${idx}`}
                  width={100}
                  style={{
                    cursor: "pointer",
                    border: isSelected
                      ? "3px solid limegreen"
                      : isActive
                        ? "2px solid red"
                        : "1px solid #555",
                  }}
                  onClick={() => {
                    handleSeek(time);
                    handleSelectFrame(time);
                  }}
                />
              );
            })}
          </div>

          {videoSrc && (
            <button onClick={handleCrop} disabled={processing} style={{ marginTop: 15, padding: "8px 16px" }}>
              {processing ? "⏳ Cropping..." : `✂️ Crop`}
            </button>
          )}

          {croppedUrl && (
            <div style={{ marginTop: 20 }}>
              <h3>✅ Cropped Video</h3>
              <video src={croppedUrl} controls width={600} />
              <a href={croppedUrl} download="cropped.mp4">
                <button style={{ marginTop: 10 }}>⬇️ Download</button>
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
