
import test from "node:test";
import assert from "node:assert/strict";
import { verifyClaims } from "../lib/citationVerifier.js";

const evidence = [
  {
    label: "Chunk 1",
    source: "computer-vision.pdf",
    page: 128,
    chunkId: "chunk-128",
    content:
      "Convolutional layers apply filters to input images to produce feature maps.",
  },
  {
    label: "Chunk 2",
    source: "computer-vision.pdf",
    page: 134,
    chunkId: "chunk-134",
    content:
      "Pooling layers summarize regions of feature maps and reduce their spatial dimensions.",
  },
];

function mockCompletion(payload) {
  return async (messages) => {
    assert.ok(Array.isArray(messages));
    return {
      choices: [
        {
          message: {
            content: JSON.stringify(payload),
          },
        },
      ],
    };
  };
}

function claim({
  text = "Convolution produces feature maps.",
  status = "supported",
  ids = ["chunk-128"],
  reason = "The evidence directly supports the claim.",
} = {}) {
  return {
    claim: text,
    status,
    supportingChunkIds: ids,
    reason,
  };
}

test("supported claims retain valid evidence and page metadata", async () => {
  const result = await verifyClaims({
    answer: "Convolution produces feature maps.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [claim()],
    }),
  });

  assert.equal(result.status, "verified");
  assert.deepEqual(result.counts, {
    supported: 1,
    uncertain: 0,
    unsupported: 0,
  });

  const item = result.claims[0];
  assert.equal(item.status, "supported");
  assert.deepEqual(item.supportingChunkIds, ["chunk-128"]);
  assert.equal(item.supportingEvidence[0].page, 128);
  assert.equal(item.supportingEvidence[0].source, "computer-vision.pdf");
  assert.equal(item.supportingEvidence[0].content, evidence[0].content);
});

test("unknown chunk IDs cannot make a claim supported", async () => {
  const result = await verifyClaims({
    answer: "CNNs always outperform every other architecture.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [
        claim({
          text: "CNNs always outperform every other architecture.",
          ids: ["fake-chunk-id"],
        }),
      ],
    }),
  });

  assert.equal(result.claims[0].status, "uncertain");
  assert.deepEqual(result.claims[0].supportingChunkIds, []);
  assert.deepEqual(result.claims[0].invalidChunkIds, ["fake-chunk-id"]);
  assert.equal(result.status, "issues_found");
});

test("unsupported claims are counted and flagged", async () => {
  const result = await verifyClaims({
    answer: "The book establishes an unsupported universal claim.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [
        claim({
          text: "The book establishes an unsupported universal claim.",
          status: "unsupported",
          ids: [],
          reason: "The supplied passages do not establish this claim.",
        }),
      ],
    }),
  });

  assert.equal(result.claims[0].status, "unsupported");
  assert.equal(result.counts.unsupported, 1);
  assert.equal(result.status, "issues_found");
});

test("uncertain claims do not produce a verified result", async () => {
  const result = await verifyClaims({
    answer: "The evidence may indicate a pattern.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [
        claim({
          text: "The evidence may indicate a pattern.",
          status: "uncertain",
        }),
      ],
    }),
  });

  assert.equal(result.claims[0].status, "uncertain");
  assert.equal(result.status, "partially_verified");
});

test("multiple claims retain separate evidence references", async () => {
  const result = await verifyClaims({
    answer: "Convolution produces feature maps. Pooling reduces spatial dimensions.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [
        claim({
          text: "Convolution produces feature maps.",
          ids: ["chunk-128"],
        }),
        claim({
          text: "Pooling reduces spatial dimensions.",
          ids: ["chunk-134"],
        }),
      ],
    }),
  });

  assert.equal(result.claims.length, 2);
  assert.equal(result.counts.supported, 2);
  assert.equal(result.claims[0].supportingEvidence[0].page, 128);
  assert.equal(result.claims[1].supportingEvidence[0].page, 134);
  assert.equal(result.status, "verified");
});

test("empty claims are not reported as verified", async () => {
  const result = await verifyClaims({
    answer: "I couldn't find this information in the uploaded document.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [],
    }),
  });

  assert.deepEqual(result.claims, []);
  assert.equal(result.status, "partially_verified");
});

test("no retrieved evidence returns unverified", async () => {
  const result = await verifyClaims({
    answer: "No relevant answer was found.",
    sourceRecords: [],
    completion: async () => {
      throw new Error("Completion should not be called");
    },
  });

  assert.equal(result.status, "unverified");
  assert.deepEqual(result.claims, []);
});

test("JSON wrapped in explanatory text can be parsed", async () => {
  const completion = async () => ({
    choices: [
      {
        message: {
          content:
            'Result:\n{"claims":[{"claim":"Convolution produces feature maps.","status":"supported","supportingChunkIds":["chunk-128"],"reason":"Directly supported."}]}\nDone.',
        },
      },
    ],
  });

  const result = await verifyClaims({
    answer: "Convolution produces feature maps.",
    sourceRecords: evidence,
    completion,
  });

  assert.equal(result.claims.length, 1);
  assert.equal(result.claims[0].status, "supported");
});

test("invalid verifier JSON rejects with a useful error", async () => {
  await assert.rejects(
    verifyClaims({
      answer: "Some answer.",
      sourceRecords: evidence,
      completion: async () => ({
        choices: [{ message: { content: "not JSON" } }],
      }),
    }),
    /Verifier returned invalid JSON/
  );
});

test("missing claims array rejects with a useful error", async () => {
  await assert.rejects(
    verifyClaims({
      answer: "Some answer.",
      sourceRecords: evidence,
      completion: mockCompletion({ result: "done" }),
    }),
    /did not contain a claims array/
  );
});

test("source-absence claims are uncertain when retrieved excerpts cannot prove absence", async () => {
  const result = await verifyClaims({
    answer: "The document does not give a formal definition of an SVM.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [claim({
        text: "The document does not give a formal definition of an SVM.",
        status: "unsupported",
        ids: [],
        reason: "The retrieved excerpts do not include a formal definition.",
      })],
    }),
  });

  assert.equal(result.claims[0].status, "uncertain");
  assert.equal(result.counts.unsupported, 0);
  assert.equal(result.counts.uncertain, 1);
  assert.equal(result.status, "partially_verified");
});

test("ordinary unsupported factual claims remain unsupported", async () => {
  const result = await verifyClaims({
    answer: "Every CNN always achieves 100% accuracy.",
    sourceRecords: evidence,
    completion: mockCompletion({
      claims: [claim({
        text: "Every CNN always achieves 100% accuracy.",
        status: "unsupported",
        ids: [],
        reason: "The supplied evidence does not support this claim.",
      })],
    }),
  });

  assert.equal(result.claims[0].status, "unsupported");
  assert.equal(result.status, "issues_found");
});
