import express from "express";
import axios from "axios";
import sharp from "sharp";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const REMOVEBG_KEY = process.env.REMOVEBG_API_KEY;

app.post("/process", async (req, res) => {
  try {
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: "Missing image_url" });
    }

    const originalResponse = await axios.get(image_url, {
      responseType: "arraybuffer"
    });

    const formData = new FormData();
    formData.append(
      "image_file_b64",
      Buffer.from(originalResponse.data).toString("base64")
    );
    formData.append("size", "auto");

    const bgResponse = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "X-Api-Key": REMOVEBG_KEY
        },
        responseType: "arraybuffer"
      }
    );

    const noBgBuffer = Buffer.from(bgResponse.data);

    const image = sharp(noBgBuffer);
    const metadata = await image.metadata();

    const whiteBackground = sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });

    const finalImage = await whiteBackground
      .composite([{ input: noBgBuffer }])
      .modulate({
        brightness: 1.03,
        saturation: 0.98
      })
      .linear(1.1, -5)
      .recomb([
        [0.97, 0, 0],
        [0, 1.0, 0],
        [0, 0, 1.02]
      ])
      .sharpen({ sigma: 1.2 })
      .jpeg({
        quality: 92,
        chromaSubsampling: "4:4:4"
      })
      .toBuffer();

    const base64 = finalImage.toString("base64");

    res.json({
      success: true,
      image_base64: `data:image/jpeg;base64,${base64}`
    });

  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).json({ error: "Processing failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
