const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VidFetch backend is running"
  });
});

app.post("/api/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Video URL is required."
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid video URL."
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        success: false,
        message: "Only HTTP and HTTPS URLs are allowed."
      });
    }

    /*
      IMPORTANT:
      This endpoint is intentionally limited to authorized
      direct media URLs.

      It does NOT extract or bypass protected media streams
      from platforms such as YouTube.
    */

    const response = await fetch(url, {
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: `Unable to access media file. HTTP ${response.status}`
      });
    }

    const contentType =
      response.headers.get("content-type") || "";

    const allowedTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo"
    ];

    const isVideo = allowedTypes.some(type =>
      contentType.toLowerCase().includes(type)
    );

    if (!isVideo) {
      return res.status(400).json({
        success: false,
        message: "The supplied URL is not an authorized direct video file."
      });
    }

    const contentLength =
      response.headers.get("content-length");

    const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

    if (contentLength && Number(contentLength) > MAX_SIZE) {
      return res.status(413).json({
        success: false,
        message: "Video file is larger than the 500 MB limit."
      });
    }

    const extension = getExtension(contentType);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="vidfetch-video.${extension}"`
    );

    res.setHeader(
      "Content-Type",
      contentType
    );

    if (contentLength) {
      res.setHeader(
        "Content-Length",
        contentLength
      );
    }

    /*
      Stream the authorized media file directly
      to the user's browser.
    */

    if (response.body) {
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        res.write(Buffer.from(value));
      }

      res.end();
    } else {
      return res.status(500).json({
        success: false,
        message: "Media stream is unavailable."
      });
    }

  } catch (error) {
    console.error("Download error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Server error while downloading the video."
      });
    }

    res.end();
  }
});


function getExtension(contentType) {

  const type = contentType.toLowerCase();

  if (type.includes("webm")) {
    return "webm";
  }

  if (type.includes("quicktime")) {
    return "mov";
  }

  if (type.includes("x-msvideo")) {
    return "avi";
  }

  return "mp4";
}


app.listen(PORT, () => {
  console.log(`VidFetch backend running on port ${PORT}`);
});