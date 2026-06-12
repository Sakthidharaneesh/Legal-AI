const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function extractTextFromImage(buffer, mimetype) {
  // 1. If Gemini is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const imagePart = {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: mimetype,
        },
      };
      const prompt = "Extract all text, clauses, and written content from this document image exactly as it is, maintaining structure where possible. Do not add any conversational remarks or explanations.";
      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text();
      if (text && text.trim()) return text;
    } catch (err) {
      console.warn("Gemini OCR extraction failed, trying OpenAI...", err.message);
    }
  }

  // 2. If OpenAI is available
  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith("gsk_")) {
    try {
      const OpenAI = require("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const base64Image = buffer.toString("base64");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all text, clauses, and written content from this document image exactly as it is, maintaining structure where possible. Do not add any conversational remarks or explanations." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimetype};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      });
      const text = response.choices[0]?.message?.content;
      if (text && text.trim()) return text;
    } catch (err) {
      console.warn("OpenAI OCR extraction failed:", err.message);
    }
  }

  throw new Error("No OCR model was able to transcribe this image. Please provide a clear plain text or PDF file.");
}

function isBinaryBuffer(buffer) {
  if (!buffer || buffer.length === 0) return false;
  const checkLen = Math.min(buffer.length, 1000);
  let controlCount = 0;
  for (let i = 0; i < checkLen; i++) {
    const byte = buffer[i];
    if (byte === 0) return true; // Null byte indicates binary format
    if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
      controlCount++;
    }
  }
  return checkLen > 0 && (controlCount / checkLen) > 0.15;
}

async function parseFileBuffer(buffer, originalname, mimetype) {
  let text = "";
  const ext = originalname.split(".").pop().toLowerCase();

  if (mimetype === "application/pdf" || ext === "pdf") {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: buffer });
    text = result.value;
  } else if (mimetype === "application/msword" || ext === "doc") {
    if (isBinaryBuffer(buffer)) {
      const raw = buffer.toString("utf8");
      text = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").replace(/\s+/g, " ").trim();
    } else {
      text = buffer.toString("utf8");
    }
  } else if (mimetype.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    text = await extractTextFromImage(buffer, mimetype);
  } else {
    if (isBinaryBuffer(buffer)) {
      throw new Error("The uploaded file appears to be a binary file, but it is not in a supported document format (PDF, DOCX, DOC, or Image).");
    }
    text = buffer.toString("utf8");
    if (mimetype === "text/html" || ext === "html" || ext === "htm") {
      text = text.replace(/<[^>]*>/g, " ");
    }
  }

  // Strip control characters from the final text
  if (text) {
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim();
  }

  return text;
}

module.exports = {
  parseFileBuffer,
  extractTextFromImage
};
