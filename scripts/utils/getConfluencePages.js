import axios from 'axios';
import { htmlToText } from 'html-to-text';
import { Document } from 'langchain/document';

const fetchConfluenceData = async (url, authToken) => {
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(`HTTP error! status: ${error.response.status}`);
  }
};

const fetchAllPagesInSpace = async (
  baseUrl,
  spaceKey,
  authToken,
  limit = 25,
  start = 0
) => {
  const url = `${baseUrl}/rest/api/content?spaceKey=${spaceKey}&limit=${limit}&start=${start}&expand=body.storage`;
  const data = await fetchConfluenceData(url, authToken);

  if (data.size === 0) {
    return [];
  }

  const nextPageStart = start + data.size;
  const nextPageResults = await fetchAllPagesInSpace(
    baseUrl,
    spaceKey,
    authToken,
    limit,
    nextPageStart
  );

  return data.results.concat(nextPageResults);
};

export const getConfluencePages = async () => {
  // Encode username and password into a base64 string
  const authToken = Buffer.from(
    `${process.env.CONFLUENCE_USERNAME}:${process.env.CONFLUENCE_ACCESS_TOKEN}`
  ).toString('base64');

  const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
  const baseUrl = process.env.CONFLUENCE_BASE_URL;

  try {
    const pages = await fetchAllPagesInSpace(baseUrl, spaceKey, authToken);

    return pages.map((page, index) => {
      // Convert the HTML content to plain text
      const plainTextContent = htmlToText(page.body.storage.value, {
        wordwrap: false,
        singleNewLineParagraphs: true,
        ignoreImage: true,
        uppercaseHeadings: true,
        preserveNewlines: false,
      });

      // Remove empty lines
      const textWithoutEmptyLines = plainTextContent.replace(
        /^\s*[\r\n]/gm,
        ''
      );

      // Generate the URL
      const pageUrl = `${baseUrl}spaces/${spaceKey}/pages/${page.id}`;

      // Return a langchain document
      return new Document({
        pageContent: `${page.title.toUpperCase()}\n${textWithoutEmptyLines}`,
        metadata: {
          title: page.title,
          url: pageUrl,
        },
      });
    });
  } catch (error) {
    console.error('Error:', error);
  }
};
