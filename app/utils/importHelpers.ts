import { parse as csvParse } from 'csv-parse/browser/esm/sync';

interface ImportedData {
  content: string;
  metadata?: Record<string, any>;
}

interface SavedItem {
  id: string;
  content: string;
  type: 'prompt' | 'rules';
  category: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const convertGitHubUrl = (url: string): string => {
  try {
    const githubRegex = /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const match = url.match(githubRegex);

    if (match) {
      const [, owner, repo, branch, path] = match;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }

    return url;
  } catch {
    return url;
  }
};

export const fetchFromUrl = async (
  url: string,
  format: string = 'text',
): Promise<{ content: string; metadata?: Record<string, any> }> => {
  try {
    // Convert GitHub URLs to raw format
    const fetchUrl = convertGitHubUrl(url);

    // Validate URL format
    try {
      new URL(fetchUrl);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Attempt to fetch the URL
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('The requested URL was not found (404)');
      } else if (response.status === 403) {
        throw new Error('Access to the URL is forbidden (403)');
      } else if (response.status === 500) {
        throw new Error('Server error occurred while fetching the URL (500)');
      } else if (response.status === 429) {
        throw new Error('Too many requests, please try again later (429)');
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    // Get content type from response headers
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';

    // Validate content type based on format
    if (format === 'json' && !contentType.includes('application/json')) {
      throw new Error('URL does not return JSON content');
    } else if (format === 'csv' && !contentType.includes('text/csv') && !contentType.includes('text/plain')) {
      throw new Error('URL does not return CSV content');
    } else if (format === 'html' && !contentType.includes('text/html')) {
      throw new Error('URL does not return HTML content');
    }

    switch (format) {
      case 'text':
        return {
          content: await response.text(),
        };

      case 'json':
        try {
          const jsonData = await response.json();
          return {
            content: typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2),
            metadata: typeof jsonData === 'object' && jsonData !== null ? jsonData : undefined,
          };
        } catch {
          throw new Error('Failed to parse JSON content');
        }

      case 'csv':
        try {
          const csvText = await response.text();
          const records = csvParse(csvText, {
            columns: true,
            skip_empty_lines: true,
          });

          return {
            content: records.map((record: any) => record.content || '').join('\n'),
            metadata: { records },
          };
        } catch {
          throw new Error('Failed to parse CSV content');
        }

      case 'html':
        try {
          const html = await response.text();
          const textContent = extractTextFromHtml(html);

          if (!textContent.trim()) {
            throw new Error('No text content found in HTML');
          }

          return {
            content: textContent,
            metadata: { originalHtml: html },
          };
        } catch {
          throw new Error('Failed to extract text from HTML');
        }

      case 'url':
        return {
          content: await response.text(),
        };

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch content from URL');
  }
};

function extractTextFromHtml(html: string): string {
  // Basic HTML text extraction - you might want to use a proper HTML parser in production
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function validateUrl(url: string): Promise<boolean> {
  try {
    // Convert GitHub URLs to raw format before validation
    const fetchUrl = convertGitHubUrl(url);

    // For GitHub raw URLs, use GET instead of HEAD as some servers block HEAD requests
    const method = fetchUrl.includes('raw.githubusercontent.com') ? 'GET' : 'HEAD';

    const response = await fetch(fetchUrl, {
      method,

      // Add headers to avoid CORS issues with GitHub
      headers: {
        Accept: 'text/plain,text/html,application/json,text/csv',
      },
    });

    return response.ok;
  } catch (_error) {
    console.error('URL validation error:', _error);
    return false;
  }
}

export function scheduleUrlCheck(
  url: string,
  format: string,
  interval: number,
  onUpdate: (data: ImportedData) => void,
): () => void {
  const checkInterval = setInterval(
    async () => {
      try {
        const data = await fetchFromUrl(url, format);
        onUpdate(data);
      } catch (_error) {
        console.error('Error checking URL for updates:', _error);
      }
    },
    interval * 60 * 1000,
  ); // Convert minutes to milliseconds

  return () => clearInterval(checkInterval);
}

// Yeni eklenen fonksiyonlar
export async function saveImportedContent(
  content: string,
  type: 'prompt' | 'rules',
  category: string,
  metadata?: Record<string, any>,
): Promise<SavedItem> {
  // TODO: Implement actual storage logic (e.g., database, localStorage, etc.)
  const item: SavedItem = {
    id: generateId(),
    content,
    type,
    category,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Geçici olarak localStorage'a kaydedelim
  const storageKey = `${type}s`; // prompts veya rules
  const existingItems = JSON.parse(localStorage.getItem(storageKey) || '[]');
  existingItems.push(item);
  localStorage.setItem(storageKey, JSON.stringify(existingItems));

  return item;
}

export async function getCategories(type: 'prompt' | 'rules'): Promise<string[]> {
  // TODO: Implement actual category fetching logic
  const storageKey = `${type}s`;
  const items = JSON.parse(localStorage.getItem(storageKey) || '[]') as SavedItem[];
  const categories = new Set(items.map((item) => item.category));

  return Array.from(categories);
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
