const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const multer = require("multer");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SHOPIFY_STORE = "nytrns-g6.myshopify.com";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BLOG_ID = "95759335636";
const GRAPHQL_URL = `https://${SHOPIFY_STORE}/admin/api/2023-10/graphql.json`;

// Token validation on startup
(async () => {
  try {
    const testRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2023-10/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    const resultText = await testRes.text();
    console.log("🧪 Shopify Token Test Response:", resultText);
  } catch (err) {
    console.error("❌ Shopify Token Test Failed:", err.message);
  }
})();

// GraphQL helper function
async function shopifyGraphql(query, variables) {
const res = await fetch(GRAPHQL_URL, {
  method: "POST",
  headers: {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Auction-App-Backend",
  },
  body: JSON.stringify({ query, variables }),
});


  const json = await res.json();

  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    throw new Error("Shopify GraphQL error");
  }

  return json.data;
}

// Create staged upload target
async function createStagedUpload(filename, contentType) {
  const mutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: [
      {
        resource: "IMAGE",
        filename,
        mimeType: contentType,
        httpMethod: "POST",
      },
    ],
  };

  const data = await shopifyGraphql(mutation, variables);
  const errors = data.stagedUploadsCreate.userErrors;
  if (errors.length) {
    throw new Error(`stagedUploadsCreate errors: ${errors.map((e) => e.message).join(", ")}`);
  }

  return data.stagedUploadsCreate.stagedTargets[0];
}

// Upload file buffer to the staging URL with form data
async function uploadToStagingUrl(stagedTarget, fileBuffer) {
  const form = new FormData();
  stagedTarget.parameters.forEach(({ name, value }) => {
    form.append(name, value);
  });
  form.append("file", fileBuffer, {
    filename: stagedTarget.parameters.find((p) => p.name === "key")?.value || "file",
  });

  const res = await fetch(stagedTarget.url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload to staging URL failed: ${res.status} ${res.statusText} - ${text}`);
  }
}

// Create a Shopify File object from the staged upload URL, then poll for readiness
async function createFileFromStaging(resourceUrl, altText) {
  const mutation = `
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          fileStatus
          ... on MediaImage {
            image {
              url
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    files: [
      {
        alt: altText,
        contentType: "IMAGE",
        originalSource: resourceUrl,
      },
    ],
  };

  const data = await shopifyGraphql(mutation, variables);
  console.log("fileCreate mutation response:", JSON.stringify(data, null, 2));

  const errors = data.fileCreate.userErrors;
  if (errors.length) {
    throw new Error(`fileCreate errors: ${errors.map((e) => e.message).join(", ")}`);
  }

  const files = data.fileCreate.files;
  if (!files || files.length === 0) {
    throw new Error("No files returned from fileCreate mutation");
  }

  let file = files[0];
  let fileStatus = file.fileStatus || "PROCESSING";

  // Poll file status until READY or FAILED
  while (fileStatus !== "READY") {
    if (fileStatus === "FAILED") {
      throw new Error("File processing failed");
    }
    console.log(`Waiting for file to be ready... Current status: ${fileStatus}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const fileDetails = await getFileStatus(file.id);
    if (!fileDetails) {
      throw new Error(`File details not found for id ${file.id}`);
    }
    fileStatus = fileDetails.status;
    file = fileDetails;
  }

  if (!file.image || !file.image.url) {
    throw new Error("No image URL found after file is ready.");
  }

  console.log("File ready:", file);
  return file;
}

async function getFileStatus(mediaImageId) {
  const query = `
    query getFileStatus($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          id
          status
          image {
            url
          }
        }
      }
    }
  `;

  const variables = { id: mediaImageId };

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();
  console.log("getFileStatus response:", JSON.stringify(data, null, 2));

  return data.data?.node;
}

async function shopifyRequest(endpoint, method, body) {
  const res = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-10/${endpoint}`, {
    method,
    headers: {
      "X-Shopify-Access-Token": ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify REST request failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

// Auction creation route
app.post("/create-auction", upload.any(), async (req, res) => {
  try {
    const files = req.files ?? [];
    let imageUrls = [];

    // Read form fields safely
    const title = req.body["Titulo de la Subasta"];
    const sellerName = req.body["Nombre del Vendedor"];
    const startingPrice = req.body["Precio Inicial"];
    const offerType = req.body["Monto Minimo de Oferta"];

    if (!title || !sellerName || !startingPrice || !offerType) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: Titulo de la Subasta, Nombre del Vendedor, Precio Inicial, or Monto Minimo de Oferta",
      });
    }

    if (files.length) {
      for (const file of files) {
        try {
          console.log(`Starting upload for ${file.originalname}`);
          const stagedTarget = await createStagedUpload(file.originalname, file.mimetype);
          console.log("Staged upload target:", stagedTarget);
          await uploadToStagingUrl(stagedTarget, file.buffer);
          const uploadedFile = await createFileFromStaging(stagedTarget.resourceUrl, file.originalname);
          console.log("Uploaded file response:", JSON.stringify(uploadedFile, null, 2));

          if (!uploadedFile) {
            throw new Error("Uploaded file is undefined");
          }

          if (uploadedFile.image && uploadedFile.image.url) {
            imageUrls.push(uploadedFile.image.url);
          } else {
            console.warn(`No image URL found on uploaded file for ${file.originalname}`, uploadedFile);
          }
        } catch (uploadErr) {
          console.error(`❌ Upload failed for ${file.originalname}:`, uploadErr);
          return res.status(400).json({
            success: false,
            message: `Image upload failed for ${file.originalname}: ${uploadErr.message}`,
          });
        }
      }
      console.log("✅ Images uploaded:", imageUrls);
    } else {
      console.log("⚠️ No image files uploaded.");
    }

    // Build article body with images
    const imagesHtml = imageUrls
      .map(
        (url) =>
          `<p><img src="${url}" alt="Auction Image" style="max-width:100%;"></p>`
      )
      .join("");

    const bodyHtml = `
  <p style="font-size: 0.95em; color: #555;"><em>Publicado por: ${sellerName}</em></p>

  <div style="display: flex; gap: 1em;">
    <p><strong>Precio Inicial:</strong> $${startingPrice}</p>
    <p><strong>Monto Mínimo de Oferta:</strong> ${offerType}</p>
  </div>

  <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
    ${imagesHtml}
  </div>
`;

    // Create article in blog
    const articleData = {
      article: {
        title,
        body_html: bodyHtml,
        published: true,
        ...(imageUrls.length > 0 && { image: { src: imageUrls[0] } }),
      },
    };

    const articleResponse = await shopifyRequest(
      `blogs/${BLOG_ID}/articles.json`,
      "POST",
      articleData
    );
    const article = articleResponse.article;

    // Add metafields to article
    const metafields = [
      {
        namespace: "auction",
        key: "Nombre del Vendedor",
        value: sellerName,
        type: "single_line_text_field",
      },
      {
        namespace: "auction",
        key: "Precio Inicial",
        value: parseInt(startingPrice, 10),
        type: "number_integer",
      },
      {
        namespace: "auction",
        key: "Monto Minimo de Oferta",
        value: offerType,
        type: "single_line_text_field",
      },
    ];

    for (const metafield of metafields) {
      await shopifyRequest(
        `articles/${article.id}/metafields.json`,
        "POST",
        { metafield }
      );
    }

    res.json({ success: true, article });
  } catch (err) {
    console.error("❌ Error creating auction:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
