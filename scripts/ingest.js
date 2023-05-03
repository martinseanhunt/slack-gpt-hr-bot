import * as dotenv from 'dotenv';
dotenv.config();

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeClient } from '@pinecone-database/pinecone';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

import { getConfluencePages } from './utils/getConfluencePages.js';

try {
  // Returns an array of confluence pages content and metadata as Documents
  const docs = await getConfluencePages();

  // chunk the docs into smaller documents with some overlap
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log('split docs', docs);

  // Initialise pinecone client and index
  console.log('Initialising pinecone');
  const pinecone = new PineconeClient();
  await pinecone.init({
    environment: process.env.PINECONE_ENVIRONMENT,
    apiKey: process.env.PINECONE_API_KEY,
  });

  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  // Get information on the namespace from pinecone
  console.log('Getting namespace info');
  const stats = await index.describeIndexStats({
    describeIndexStatsRequest: {},
  });

  // delete any old entries already attached to the namespace
  // if it already exists
  if (stats?.namespaces[process.env.PINECONE_NAME_SPACE]) {
    console.log('namespace exists, deleting old vectors');

    await index.delete1({
      deleteAll: true,
      namespace: process.env.PINECONE_NAME_SPACE,
    });
  }

  //embed the PDF documents
  console.log('Embedding docs and storing in pinecone');
  await PineconeStore.fromDocuments(splitDocs, new OpenAIEmbeddings(), {
    pineconeIndex: index,
    namespace: process.env.PINECONE_NAME_SPACE,
    textKey: 'text',
  });

  console.log('finished');
} catch (error) {
  console.error(error);
}
