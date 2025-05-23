import 'dotenv/config'; // Load .env file into process.env

/**
 * News Service
 * 
 * This service provides news data related to the dental and aesthetic industries.
 * It fetches news articles from various sources and provides filtering capabilities.
 * Fetching priority: Supabase → External sources (Brave search/Firecrawl) → Mock data
 */

import { supabaseClient } from './supabase/supabaseClient.js';

/**
 * Fetch news articles for the specified industry
 * @param {string} industry - 'dental' or 'aesthetic'
 * @param {Object} options - Options for filtering news
 * @param {number} options.limit - Maximum number of articles to return (default: 10)
 * @param {number} options.offset - Number of articles to skip (default: 0)
 * @param {string} options.category - Category to filter by (optional)
 * @param {string} options.source - Source to filter by (optional)
 * @param {string} options.searchTerm - Term to search for in title or content (optional)
 * @returns {Promise<Array>} - Array of news article objects
 */
export const getNewsArticles = async (industry, options = {}) => {
  // First, attempt to fetch from Supabase
  try {
    console.log(`Fetching ${industry} news articles from Supabase...`);
    const { limit = 10, category = null, source = null, searchTerm = null } = options;
    
    // Get articles from the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();
    
    let query = supabaseClient
      .from('news_articles')
      .select('*')
      .eq('industry', industry.toLowerCase())
      .gte('published_date', oneWeekAgoStr)
      .order('published_date', { ascending: false })
      .limit(limit);
    
    if (category) query = query.eq('category', category);
    if (source) query = query.eq('source', source);
    if (searchTerm) query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      console.log(`Found ${data.length} ${industry} news articles in Supabase`);
      return data;
    }
    
    // If no data in Supabase or not enough articles, fetch from external sources
    console.log(`Not enough recent ${industry} news articles in Supabase, fetching from external sources...`);
    const external = await fetchNewsFromExternalSources(industry, {
      ...options,
      limit: limit - (data?.length || 0) // Only fetch what we need to reach the limit
    });
    
    if (external && external.length > 0) {
      console.log(`Found ${external.length} ${industry} news articles externally`);
      // Combine with any existing Supabase data
      return [...(data || []), ...external];
    }
  } catch (supErr) {
    console.error('Error fetching news from Supabase:', supErr);
    
    // If Supabase fails, try external sources
    try {
      console.log(`Trying external sources after Supabase error...`);
      const external = await fetchNewsFromExternalSources(industry, options);
      if (external && external.length > 0) {
        console.log(`Found ${external.length} ${industry} news articles externally`);
        return external;
      }
    } catch (extErr) {
      console.error('Error fetching news from external sources:', extErr);
    }
  }
  
  // Last resort: mock
  console.log(`No news found; generating mock ${industry} news...`);
  const { limit = 10, category = null, source = null } = options;
  return generateMockNewsArticles(industry, limit, category, source);
};

/**
 * Fetch news articles from external sources (Brave search and Firecrawl)
 * @param {string} industry - 'dental' or 'aesthetic'
 * @param {Object} options - Options for filtering news
 * @returns {Promise<Array>} - Array of news article objects
 */
export const fetchNewsFromExternalSources = async (industry, options = {}) => {
  const { 
    limit = 10, 
    category = null, 
    source = null,
    searchTerm = null
  } = options;

  try {
    // Build search query based on options
    let searchQuery = `${industry} industry news`;
    
    if (category) {
      searchQuery += ` ${category}`;
    }
    
    if (source) {
      searchQuery += ` from ${source}`;
    }
    
    if (searchTerm) {
      searchQuery += ` ${searchTerm}`;
    }
    
    // Add time constraint to get only recent news (past week)
    searchQuery += " past week";
    
    // Determine which service to use based on a random selection to alternate
    const useFirecrawl = Math.random() > 0.5;
    
    let results = [];
    if (useFirecrawl) {
      console.log(`Using Firecrawl to search for: "${searchQuery}"`);
      results = await searchWithFirecrawl(searchQuery, limit);
    } else {
      console.log(`Using Brave Search to search for: "${searchQuery}"`);
      results = await fetchFromBraveSearch(searchQuery, limit);
    }
    
    // Process the search results to extract article information
    const articles = [];
    const processedUrls = new Set(); // To avoid duplicates
    
    for (const result of results) {
      // Skip if we've already processed this URL
      if (processedUrls.has(result.url)) continue;
      processedUrls.add(result.url);
      
      // Get more details about the article using Firecrawl
      const articleDetails = await fetchArticleDetailsWithFirecrawl(result.url);
      
      // Determine the category based on content or default to a general category
      const articleCategory = determineCategory(
        result.title + ' ' + result.description + ' ' + (articleDetails.content || ''),
        industry
      );
      
      // Determine the source from the URL or use the domain name
      const articleSource = determineSource(result.url);
      
      // Ensure the article is from the past week
      const publishedDate = articleDetails.published_date || new Date().toISOString();
      const articleDate = new Date(publishedDate);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      if (articleDate < oneWeekAgo) {
        console.log(`Skipping article older than one week: ${result.title}`);
        continue;
      }
      
      // Create an article object with the data we have
      const article = {
        id: articles.length + 1,
        title: result.title || 'Untitled Article',
        summary: articleDetails.summary || result.description || '',
        content: articleDetails.content || result.description || '',
        image_url: articleDetails.image_url || result.image_url || '',
        url: result.url,
        published_date: publishedDate,
        author: articleDetails.author || 'Unknown',
        source: articleSource,
        category: articleCategory,
        industry: industry.toLowerCase(),
        featured: false // Default to not featured
      };
      
      articles.push(article);
      
      // If we have enough articles, stop
      if (articles.length >= limit) {
        break;
      }
    }
    
    // Store the articles in Supabase for future use
    if (articles.length > 0) {
      await storeArticlesInSupabase(articles);
    }
    
    return articles;
  } catch (error) {
    console.error('Error fetching news from external sources:', error);
    // Return mock data as a last resort
    return generateMockNewsArticles(industry, limit, category, source);
  }
};

/**
 * Search for news articles using Firecrawl
 * @param {string} query - Search query
 * @param {number} count - Number of results to return
 * @returns {Promise<Array>} - Array of search results
 */
const searchWithFirecrawl = async (query, count = 10) => {
  if (process.env.NODE_ENV === 'production' || typeof use_mcp_tool !== 'function') {
    console.log('[Prod/No MCP] Skipping Firecrawl search. Will rely on Brave Search if available.');
    return []; // Return empty, let the caller (fetchNewsFromExternalSources) use Brave search
  }

  try {
    console.log(`[Dev Only] Making call to Firecrawl MCP for search: ${query}`);
    
    // Use the Firecrawl MCP search tool
    const searchResult = await use_mcp_tool({
      server_name: 'github.com/mendableai/firecrawl-mcp-server',
      tool_name: 'firecrawl_search',
      arguments: {
        query: query,
        limit: count,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          waitFor: 5000
        }
      }
    });
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      throw new Error(`Firecrawl MCP returned no results for ${query}`);
    }
    
    console.log(`Successfully found ${searchResult.results.length} results with Firecrawl MCP`);
    
    // Map to article format
    return searchResult.results.map(item => ({
      id: item.url,
      title: item.title || 'Untitled',
      url: item.url,
      summary: item.description || '',
      image_url: item.image || '',
      source: determineSource(item.url),
      published_date: item.published_date || new Date().toISOString()
    }));
  } catch (error) {
    console.error(`Error searching with Firecrawl MCP: ${error}`);
    throw error;
  }
};

/**
 * Fetch data from Brave Search REST API
 * @param {string} query - Search query
 * @param {number} count - Number of results to return
 * @returns {Promise<Array>} - Array of search results
 */
const fetchFromBraveSearch = async (query, count = 10) => {
  // Ensure correct environment variable access for Node.js scripts
  const apiKey = process.env.BRAVE_SEARCH_API_KEY || process.env.VITE_BRAVE_SEARCH_API_KEY;
  
  if (!apiKey) {
    console.error('Brave Search API key not found in environment variables for newsService.js');
    return []; // Return empty array if API key is missing
  }
  
  // Brave Search API count parameter has a maximum of 20.
  const effectiveCount = Math.min(count, 20);

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${effectiveCount}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brave Search API request failed: ${response.status} ${response.statusText}`, errorText);
      return [];
    }
    
    const data = await response.json();
    // Transform the Brave API response to match the expected structure (e.g., { title, url, description })
    return data.web && data.web.results ? data.web.results.map(r => ({ 
      title: r.title, 
      url: r.url, 
      description: r.description 
      // Add other fields if your processing logic expects them directly from search
    })) : [];
  } catch (error) {
    console.error('Error fetching from Brave Search API:', error);
    return [];
  }
};

/**
 * Fetch article details using Firecrawl MCP
 * @param {string} url - Article URL
 * @returns {Promise<Object>} - Article details
 */
const fetchArticleDetailsWithFirecrawl = async (url) => {
  if (process.env.NODE_ENV === 'production' || typeof use_mcp_tool !== 'function') {
    console.log(`[Prod/No MCP] Skipping Firecrawl article details scrape for: ${url}`);
    return { summary: '', content: '', image_url: '', published_date: null, author: '' }; // Return empty/default details
  }

  try {
    console.log(`[Dev Only] Scraping article details: ${url} using Firecrawl MCP`);
    
    // Use the Firecrawl MCP
    const scrapeResult = await use_mcp_tool({
      server_name: 'github.com/mendableai/firecrawl-mcp-server',
      tool_name: 'firecrawl_scrape',
      arguments: {
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: true
      }
    });
    
    if (!scrapeResult || !scrapeResult.markdown) {
      throw new Error(`Firecrawl MCP returned no content for ${url}`);
    }
    
    console.log(`Successfully extracted content from ${url} using Firecrawl MCP`);
    // Extract information from the scraped content
    return extractArticleDetailsFromContent(scrapeResult.markdown, url, scrapeResult.html);
  } catch (error) {
    console.error(`Error fetching article details with Firecrawl MCP for ${url}:`, error);
    throw error; // Explicitly throw to force fallback
  }
};

/**
 * Extract article details from content
 * @param {string} content - Markdown content to extract details from
 * @param {string} url - Article URL
 * @param {string} html - HTML content (optional)
 * @returns {Object} - Article details
 */
const extractArticleDetailsFromContent = (content, url, html) => {
  const details = {
    summary: '',
    content: content,
    image_url: '',
    published_date: null,
    author: ''
  };

  // Try to extract Open Graph image first if HTML is available
  if (html) {
    const ogImagePattern = /<meta\s+property=(?:"og:image"|'og:image')\s+content=(?:"([^"]*)"|'([^']*)')\s*\/?>/i;
    const ogImageMatch = html.match(ogImagePattern);
    if (ogImageMatch && (ogImageMatch[1] || ogImageMatch[2])) {
      details.image_url = ogImageMatch[1] || ogImageMatch[2];
      // Make sure the URL is absolute
      if (details.image_url && details.image_url.startsWith('/')) {
        try {
          const urlObj = new URL(url);
          details.image_url = `${urlObj.protocol}//${urlObj.hostname}${details.image_url}`;
        } catch (e) {
          console.error(`Error creating absolute URL from og:image: ${e}`);
        }
      }
    }
  }

  // If no Open Graph image, extract image URL - first try markdown format
  if (!details.image_url) {
    const markdownImagePattern = /!\[.*?\]\((https?:\/\/[^)]+)\)/;
    const markdownImageMatch = content.match(markdownImagePattern);
    if (markdownImageMatch && markdownImageMatch[1]) {
      details.image_url = markdownImageMatch[1];
    } 
    // If no markdown image, try to extract from HTML if available (and no OG image was found)
    else if (html) {
      const imgTagPattern = /<img[^>]+src="([^"]+)"[^>]*>/i;
      const imgMatches = html.match(imgTagPattern);
      if (imgMatches && imgMatches[1]) {
        details.image_url = imgMatches[1];
        
        // Make sure the URL is absolute
        if (details.image_url.startsWith('/')) {
          try {
            const urlObj = new URL(url);
            details.image_url = `${urlObj.protocol}//${urlObj.hostname}${details.image_url}`;
          } catch (e) {
            console.error(`Error creating absolute URL from img src: ${e}`);
          }
        }
      }
    }
  }
  
  // Extract summary (first 200 characters)
  if (content.length > 0) {
    // Find the first paragraph that's not too short
    const paragraphs = content.split('\n\n');
    for (const paragraph of paragraphs) {
      if (paragraph.length > 100 && paragraph.length < 500 && !paragraph.startsWith('#')) {
        details.summary = paragraph;
        break;
      }
    }
    
    // If no good paragraph found, use the first 200 characters
    if (!details.summary) {
      details.summary = content.substring(0, 200).replace(/\n/g, ' ') + '...';
    }
  }
  
  // Extract published date - expanded patterns
  const datePatterns = [
    /published(?:\s+on)?:\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /date:\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /posted(?:\s+on)?:\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\s+\w+\s+\d{4})/i, // Day Month Year format
    /(\w+\s+\d{1,2},?\s+\d{4})/i, // Month Day, Year format
    /(\d{4}-\d{2}-\d{2})/i // ISO format
  ];
  
  for (const pattern of datePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      try {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          details.published_date = parsedDate.toISOString();
          break;
        }
      } catch (e) {
        console.log(`Failed to parse date: ${match[1]}`);
      }
    }
  }
  
  // If no date found, use current date
  if (!details.published_date) {
    details.published_date = new Date().toISOString();
  }
  
  // Extract author - expanded patterns
  const authorPatterns = [
    /by\s+([A-Za-z\s.]+)(?:\s*,|\s+on|\s+\||\n)/i,
    /author(?:\s*:|s?)\s+([A-Za-z\s.]+)(?:\s*,|\s+on|\s+\||\n)/i,
    /written by\s+([A-Za-z\s.]+)(?:\s*,|\s+on|\s+\||\n)/i,
    /contributor:\s+([A-Za-z\s.]+)(?:\s*,|\s+on|\s+\||\n)/i
  ];
  
  for (const pattern of authorPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      details.author = match[1].trim();
      break;
    }
  }
  
  return details;
};

/**
 * Determine the source of an article from its URL
 * @param {string} url - Article URL
 * @returns {string} - Source name
 */
const determineSource = (url) => {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    // Remove www. prefix if present
    hostname = hostname.replace(/^www\./, '');
    
    // Extract the main domain name
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // For common domains like .com, .org, etc., use the second-to-last part
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
    
    return hostname;
  } catch (error) {
    console.error('Error determining source from URL:', error);
    return 'Unknown Source';
  }
};

/**
 * Determine the category of an article based on its content
 * @param {string} content - Article content
 * @param {string} industry - Industry (dental or aesthetic)
 * @returns {string} - Category
 */
const determineCategory = (content, industry) => {
  const contentLower = content.toLowerCase();
  
  // Define category keywords for each industry
  const dentalCategories = {
    'Technology': ['technology', 'digital', 'software', 'ai', 'artificial intelligence', 'machine learning', 'innovation', 'tech'],
    'Business': ['business', 'market', 'industry', 'revenue', 'growth', 'acquisition', 'merger', 'investment'],
    'Clinical': ['clinical', 'treatment', 'procedure', 'patient', 'care', 'therapy', 'diagnosis', 'health'],
    'Education': ['education', 'training', 'course', 'certification', 'degree', 'student', 'learning', 'school'],
    'Research': ['research', 'study', 'trial', 'investigation', 'discovery', 'science', 'scientific', 'development'],
    'Regulation': ['regulation', 'compliance', 'law', 'legal', 'fda', 'approval', 'guideline', 'standard']
  };
  
  const aestheticCategories = {
    'Technology': ['technology', 'digital', 'software', 'ai', 'artificial intelligence', 'machine learning', 'innovation', 'tech'],
    'Business': ['business', 'market', 'industry', 'revenue', 'growth', 'acquisition', 'merger', 'investment'],
    'Treatments': ['treatment', 'procedure', 'injection', 'filler', 'botox', 'laser', 'surgery', 'therapy'],
    'Skincare': ['skin', 'skincare', 'cream', 'serum', 'moisturizer', 'cleanser', 'anti-aging', 'wrinkle'],
    'Wellness': ['wellness', 'health', 'lifestyle', 'nutrition', 'diet', 'exercise', 'holistic', 'natural'],
    'Trends': ['trend', 'popular', 'celebrity', 'influencer', 'social media', 'instagram', 'tiktok', 'viral']
  };
  
  // Select the appropriate categories based on industry
  const categories = industry.toLowerCase() === 'dental' ? dentalCategories : aestheticCategories;
  
  // Count keyword matches for each category
  const categoryCounts = {};
  
  for (const [category, keywords] of Object.entries(categories)) {
    categoryCounts[category] = 0;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = contentLower.match(regex);
      
      if (matches) {
        categoryCounts[category] += matches.length;
      }
    }
  }
  
  // Find the category with the most matches
  let bestCategory = 'General';
  let maxCount = 0;
  
  for (const [category, count] of Object.entries(categoryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestCategory = category;
    }
  }
  
  return bestCategory;
};

/**
 * Store articles in Supabase
 * @param {Array} articles - Array of article objects
 */
const storeArticlesInSupabase = async (articles) => {
  try {
    for (const article of articles) {
      const { error } = await supabaseClient
        .from('news_articles')
        .upsert(article, { 
          onConflict: 'url', // Corrected: Use only the 'url' column for conflict
          ignoreDuplicates: true 
        });
      
      if (error) {
        // Log the error but don't throw, allow other articles to process
        console.error('Error storing article in Supabase:', error);
      }
    }
    console.log(`Attempted to store ${articles.length} articles in Supabase`);
  } catch (error) {
    console.error('Error storing articles in Supabase:', error);
  }
};

/**
 * Generate mock news articles as a last resort
 * @param {string} industry - Industry (dental or aesthetic)
 * @param {number} limit - Number of articles to generate
 * @param {string} category - Category to filter by (optional)
 * @param {string} source - Source to filter by (optional)
 * @returns {Array} - Array of mock news articles
 */
const generateMockNewsArticles = (industry, limit = 10, category = null, source = null) => {
  const mockArticles = [];
  
  // Define categories based on industry
  const dentalCategories = ['Technology', 'Business', 'Clinical', 'Education', 'Research', 'Regulation'];
  const aestheticCategories = ['Technology', 'Business', 'Treatments', 'Skincare', 'Wellness', 'Trends'];
  
  // Use appropriate categories based on industry
  const categories = industry.toLowerCase() === 'dental' ? dentalCategories : aestheticCategories;
  
  // Define sources
  const sources = ['DentistryToday', 'MedicalNews', 'HealthInsider', 'IndustryWeekly', 'TechMedica', 'ClinicalJournal'];
  
  // Define title templates
  const titleTemplates = [
    'New [TECH] Revolutionizes [INDUSTRY] Industry',
    'Study Shows [PERCENTAGE]% Increase in [TREATMENT] Effectiveness',
    'Leading [INDUSTRY] Companies Announce Partnership',
    '[COMPANY] Launches Innovative [PRODUCT] for [INDUSTRY] Professionals',
    'Experts Predict [INDUSTRY] Market Growth of [PERCENTAGE]% by 2026',
    'Breakthrough in [TREATMENT] Technology Promises Better Patient Outcomes',
    'Regulatory Changes Impact [INDUSTRY] Practices Nationwide',
    'Survey Reveals Top [INDUSTRY] Trends for 2025',
    '[COMPANY] Acquires [COMPANY] in $[AMOUNT]M Deal',
    'New Research Highlights Benefits of [TREATMENT] Approach'
  ];
  
  // Define content templates
  const contentTemplates = [
    'A recent development in [INDUSTRY] technology has shown promising results in clinical trials. Experts believe this could lead to significant improvements in patient care and treatment outcomes. Industry leaders are already investing in this technology, with market analysts predicting widespread adoption within the next two years.',
    'Market research indicates a growing trend in [INDUSTRY] practices, with more professionals adopting new techniques and technologies. Patient satisfaction rates have increased by [PERCENTAGE]%, and treatment times have decreased by [PERCENTAGE]%. This shift represents a significant evolution in how [INDUSTRY] care is delivered.',
    'Regulatory bodies have announced new guidelines for [INDUSTRY] practices, focusing on patient safety and treatment efficacy. These changes will require practitioners to update their protocols and potentially invest in new equipment. Industry associations are providing resources to help professionals adapt to these new requirements.',
    'A landmark study published in the Journal of [INDUSTRY] Medicine has revealed new insights into treatment methodologies. The research, conducted over a three-year period with [NUMBER] participants, demonstrates that innovative approaches can yield better long-term results for patients while reducing recovery time and complications.',
    'Industry leaders gathered at the annual [INDUSTRY] Conference to discuss emerging trends and challenges. Key topics included technological innovation, patient experience enhancement, and sustainable practice management. Attendees were particularly interested in new digital solutions that streamline administrative processes while improving clinical outcomes.'
  ];
  
  // Generate mock articles
  for (let i = 0; i < limit; i++) {
    // Select random category or use provided category
    const articleCategory = category || categories[Math.floor(Math.random() * categories.length)];
    
    // Select random source or use provided source
    const articleSource = source || sources[Math.floor(Math.random() * sources.length)];
    
    // Generate random date within the last 30 days
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    // Select random title template and customize it
    let title = titleTemplates[Math.floor(Math.random() * titleTemplates.length)];
    title = title
      .replace('[TECH]', ['AI', 'Machine Learning', 'Digital Scanning', 'Robotics', 'Cloud Computing'][Math.floor(Math.random() * 5)])
      .replace('[INDUSTRY]', industry)
      .replace('[PERCENTAGE]', Math.floor(Math.random() * 30 + 20).toString())
      .replace('[TREATMENT]', industry === 'dental' ? 
        ['Implant', 'Orthodontic', 'Periodontal', 'Endodontic', 'Cosmetic'][Math.floor(Math.random() * 5)] : 
        ['Laser', 'Injectable', 'Surgical', 'Non-invasive', 'Dermal'][Math.floor(Math.random() * 5)])
      .replace('[COMPANY]', ['MediTech', 'HealthPlus', 'InnovaCare', 'NextGen', 'PrimeSolutions'][Math.floor(Math.random() * 5)])
      .replace('[PRODUCT]', ['System', 'Solution', 'Platform', 'Device', 'Software'][Math.floor(Math.random() * 5)])
      .replace('[AMOUNT]', (Math.floor(Math.random() * 900) + 100).toString());
    
    // Select random content template and customize it
    let content = contentTemplates[Math.floor(Math.random() * contentTemplates.length)];
    content = content
      .replace(/\[INDUSTRY\]/g, industry)
      .replace(/\[PERCENTAGE\]/g, Math.floor(Math.random() * 30 + 20).toString())
      .replace(/\[NUMBER\]/g, (Math.floor(Math.random() * 900) + 100).toString());
    
    // Create mock article
    const article = {
      id: i + 1,
      title: title,
      summary: content.substring(0, 150) + '...',
      content: content,
      image_url: '',
      url: `https://www.${articleSource.toLowerCase()}.com/news/${i + 1}`,
      published_date: date.toISOString(),
      author: ['Dr. John Smith', 'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Wilson'][Math.floor(Math.random() * 5)],
      source: articleSource,
      category: articleCategory,
      industry: industry.toLowerCase(),
      featured: i < 2 // First two articles are featured
    };
    
    mockArticles.push(article);
  }
  
  return mockArticles;
};

/**
 * Fetch news categories for the specified industry
 * @param {string} industry - 'dental' or 'aesthetic'
 * @returns {Promise<Array>} - Array of category objects
 */
export const getNewsCategories = async (industry) => {
  try {
    const { data, error } = await supabaseClient
      .from('news_categories')
      .select('*')
      .eq('industry', industry);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching news categories:', error);
    return [];
  }
};

/**
 * Fetch news sources for the specified industry
 * @param {string} industry - 'dental' or 'aesthetic'
 * @returns {Promise<Array>} - Array of source objects
 */
export const getNewsSources = async (industry) => {
  try {
    const { data, error } = await supabaseClient
      .from('news_sources')
      .select('*')
      .eq('industry', industry);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching news sources:', error);
    return [];
  }
};

/**
 * Fetch featured news articles for the specified industry
 * @param {string} industry - 'dental' or 'aesthetic'
 * @param {number} limit - Maximum number of articles to return (default: 3)
 * @returns {Promise<Array>} - Array of featured news article objects
 */
export const getFeaturedNewsArticles = async (industry, limit = 3) => {
  try {
    const { data, error } = await supabaseClient
      .from('news_articles')
      .select('*')
      .eq('industry', industry)
      .eq('featured', true)
      .order('published_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching featured news articles:', error);
    return [];
  }
};

/**
 * Fetch trending topics for the specified industry
 * @param {string} industry - 'dental' or 'aesthetic'
 * @param {number} limit - Maximum number of topics to return (default: 5)
 * @returns {Promise<Array>} - Array of trending topic objects
 */
export const getTrendingTopics = async (industry, limit = 5) => {
  try {
    const { data, error } = await supabaseClient
      .from('trending_topics')
      .select('*')
      .eq('industry', industry)
      .order('popularity', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    return [];
  }
};

/**
 * Fetch upcoming industry events
 * @param {string} industry - 'dental' or 'aesthetic'
 * @param {number} limit - Maximum number of events to return (default: 5)
 * @returns {Promise<Array>} - Array of event objects
 */
export const getUpcomingEvents = async (industry, limit = 5) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data, error } = await supabaseClient
      .from('industry_events')
      .select('*')
      .eq('industry', industry)
      .gte('start_date', today)
      .order('start_date', { ascending: true })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }
};
