import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";
import path from "path";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", " ", ""],
});

export async function processDocument(filePath, originalName, documentId) {
  const ext = path.extname(originalName).toLowerCase();
  let rawDocs;

  if (ext === ".pdf") {
    const loader = new PDFLoader(filePath);
    rawDocs = await loader.load();
  } else if (ext === ".txt") {
    const content = await fs.readFile(filePath, "utf-8");

    rawDocs = [
      {
        pageContent: content,
        metadata: {
          source: originalName,
          page: 1,
          pageNumber: 1,
        },
      },
    ];
  } else {
    throw new Error(
      `Unsupported file type: ${ext}. Only PDF and TXT are supported.`
    );
  }

  const chunks = await splitter.splitDocuments(rawDocs);

  const enrichedChunks = chunks.map((chunk, index) => {
    const rawPage =
      chunk.metadata?.pageNumber ??
      chunk.metadata?.loc?.pageNumber ??
      chunk.metadata?.page;

    const pageNumber =
      rawPage != null &&
      Number.isInteger(Number(rawPage)) &&
      Number(rawPage) >= 0
        ? Number(rawPage)
        : null;

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        source: originalName,
        documentId: documentId || null,
        chunkId: documentId ? `${documentId}:${index}` : null,
        chunkIndex: index,
        totalChunks: chunks.length,
        page: pageNumber,
        pageNumber,
      },
    };
  });

  console.log(
    `Processed "${originalName}": ${rawDocs.length} source page(s) -> ${enrichedChunks.length} chunks`
  );

  console.log(
    "[DocumentProcessor] Page metadata sample:",
    enrichedChunks.slice(0, 5).map((chunk) => ({
      chunkId: chunk.metadata.chunkId,
      page: chunk.metadata.pageNumber,
      metadataKeys: Object.keys(chunk.metadata),
    }))
  );

  return enrichedChunks;
}