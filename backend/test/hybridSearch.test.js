import test from 'node:test';
import assert from 'node:assert/strict';
import { decomposeQuery, selectDiverseResults, selectFacetAwareResults } from '../lib/retrievalSelection.js';

test('decomposeQuery splits generic multi-part questions without topic rules', () => {
  const facets = decomposeQuery('Summarize Chapter 30 about FaceNet and Chapter 29 about VGGFace2.');
  assert.equal(facets.length, 2);
  assert.match(facets[0], /FaceNet/i);
  assert.match(facets[1], /VGGFace2/i);
});

test('decomposeQuery preserves a single simple question', () => {
  assert.deepEqual(decomposeQuery('What is backpropagation?'), ['What is backpropagation?']);
});

test('selectDiverseResults avoids near-duplicate chunks when relevant alternatives exist', () => {
  const chunks = [
    { pageContent: 'Neural networks use gradient descent to optimize weights and minimize loss.' },
    { pageContent: 'Gradient descent optimizes neural network weights by minimizing the loss function.' },
    { pageContent: 'A convolutional layer applies learned filters to local image regions.' },
  ];
  const selected = selectDiverseResults(chunks, 2, 0.55);
  assert.equal(selected.length, 2);
  assert.equal(selected[0], chunks[0]);
  assert.equal(selected[1], chunks[2]);
});


test('facet-aware selection keeps evidence for distinct parts of a query', () => {
  const overview = { metadata: { chunkId: 'overview' }, pageContent: 'General overview of both topics.' };
  const topicA = { metadata: { chunkId: 'topic-a' }, pageContent: 'Detailed evidence for the first requested concept.' };
  const topicB = { metadata: { chunkId: 'topic-b' }, pageContent: 'Detailed evidence for the second requested concept.' };
  const extra = { metadata: { chunkId: 'extra' }, pageContent: 'Additional useful evidence with a distinct explanation.' };

  const selected = selectFacetAwareResults(
    [[topicA, overview, topicB], [topicB, overview, topicA]],
    [overview, topicA, topicB, extra],
    3
  );
  const ids = selected.map((chunk) => chunk.metadata.chunkId);
  assert.ok(ids.includes('topic-a'));
  assert.ok(ids.includes('topic-b'));
  assert.equal(new Set(ids).size, ids.length);
});

test('decomposeQuery excludes source-restriction instructions from retrieval facets', () => {
  const facets = decomposeQuery('According to the uploaded paper on AI in Education, what are its three main areas of personalized learning? Do not use information from any other document.');
  assert.equal(facets.length, 1);
  assert.match(facets[0], /three main areas of personalized learning/i);
  assert.doesNotMatch(facets[0], /do not use information/i);
});
