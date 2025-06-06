import React, { useState, useEffect } from 'react';
import { useIndustryTheme } from '../services/theme/IndustryThemeContext';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  CardActionArea,
  Tabs, 
  Tab, 
  TextField, 
  InputAdornment,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  CircularProgress,
  Paper,
  Link,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EventIcon from '@mui/icons-material/Event';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ArticleIcon from '@mui/icons-material/Article';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LinkIcon from '@mui/icons-material/Link';

import { 
  getNewsArticles, 
  getNewsCategories, 
  getNewsSources, 
  getFeaturedNewsArticles,
  getTrendingTopics,
  getUpcomingEvents
} from '../services/newsService';

import { 
  getReliableImageUrl, 
  getFallbackImageUrl, 
  getBackupImagesForCategory, 
  getRotationIndex 
} from '../services/imageService';
import { getGeminiFallbackImageUrl } from '../services/geminiImageService';

const MarketNewsTab = ({ isDental: propIsDental }) => {
  const { industry } = useIndustryTheme();
  // Use prop value as a fallback, but prioritize the context value
  const isDental = propIsDental !== undefined ? propIsDental : industry === 'dental';
  const currentIndustry = isDental ? 'dental' : 'aesthetic';
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState([]);
  const [featuredArticles, setFeaturedArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch data on component mount and when industry changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch all data in parallel
        const [
          articlesData,
          featuredArticlesData,
          categoriesData,
          sourcesData,
          trendingTopicsData,
          upcomingEventsData
        ] = await Promise.all([
          getNewsArticles(currentIndustry),
          getFeaturedNewsArticles(currentIndustry),
          getNewsCategories(currentIndustry),
          getNewsSources(currentIndustry),
          getTrendingTopics(currentIndustry),
          getUpcomingEvents(currentIndustry)
        ]);
        
        console.log('Fetched news articles:', articlesData.map(a => ({ id: a.id, image_url: a.image_url })));
        
        // Sort by newest date
        const sortedArticles = articlesData.sort((a,b) => new Date(b.published_date) - new Date(a.published_date));
        const sortedFeatured = featuredArticlesData.sort((a,b) => new Date(b.published_date) - new Date(a.published_date));
        setArticles(sortedArticles);
        setFeaturedArticles(sortedFeatured);
        
        // Fallback to derive categories from articles if none in DB
        const cats = categoriesData && categoriesData.length > 0
          ? categoriesData
          : Array.from(new Set(articlesData.map(a => a.category)))
              .map(name => ({ id: name, category: name }));
        setCategories(cats);
        
        // Fallback to derive sources from articles if none in DB
        const srcs = sourcesData && sourcesData.length > 0
          ? sourcesData
          : Array.from(new Set(articlesData.map(a => a.source)))
              .map(name => ({ id: name, source: name }));
        setSources(srcs);
        
        setTrendingTopics(trendingTopicsData);
        setUpcomingEvents(upcomingEventsData);
      } catch (error) {
        console.error('Error fetching news data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Reset filters when industry changes
    setSelectedCategory('All');
    setSelectedSource('All');
    setSearchTerm('');
    setActiveTab(0);
  }, [currentIndustry]);
  
  // Handle search input change
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };
  
  // Handle search submission
  const handleSearch = async () => {
    setLoading(true);
    
    try {
      const options = {
        searchTerm: searchTerm,
        category: selectedCategory !== 'All' ? selectedCategory : null,
        source: selectedSource !== 'All' ? selectedSource : null
      };
      
      const articlesData = await getNewsArticles(industry, options);
      setArticles(articlesData);
    } catch (error) {
      console.error('Error searching news:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle category filter change
  const handleCategoryChange = async (category) => {
    setSelectedCategory(category);
    setLoading(true);
    
    try {
      const options = {
        category: category !== 'All' ? category : null,
        source: selectedSource !== 'All' ? selectedSource : null,
        searchTerm: searchTerm || null
      };
      
      const articlesData = await getNewsArticles(industry, options);
      setArticles(articlesData);
    } catch (error) {
      console.error('Error filtering by category:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle source filter change
  const handleSourceChange = async (source) => {
    setSelectedSource(source);
    setLoading(true);
    
    try {
      const options = {
        category: selectedCategory !== 'All' ? selectedCategory : null,
        source: source !== 'All' ? source : null,
        searchTerm: searchTerm || null
      };
      
      const articlesData = await getNewsArticles(industry, options);
      setArticles(articlesData);
    } catch (error) {
      console.error('Error filtering by source:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  // Render featured articles carousel
  const renderFeaturedArticles = () => {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom color="primary" fontWeight="bold">
          Featured Articles
        </Typography>
        <Grid container spacing={3}>
          {featuredArticles.map((article) => (
            <Grid item xs={12} md={4} key={article.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  boxShadow: 3,
                  transition: 'transform 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: 6
                  }
                }}
              >
                <CardActionArea component="a" href={article.url} target="_blank" rel="noopener noreferrer">
                  <CardMedia
                    component="img"
                    height="180"
                    src={getReliableImageUrl(article.image_url, article, industry)}
                    alt={article.title}
                    onError={(e) => {
                      console.log('Featured image failed to load for:', article.title);
                      
                      // First, set a reliable placeholder while we get premium image
                      const tempPlaceholder = 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80';
                      e.target.src = tempPlaceholder;
                      
                      // Primarily use Gemini for high-quality images
                      const loadPremiumImage = async () => {
                        try {
                          // Use a timestamp to ensure we get a unique image
                          const uniqueTimestamp = Date.now();
                          
                          // Get premium Gemini image with unique timestamp
                          const geminiUrl = await getGeminiFallbackImageUrl(article, industry);
                          if (geminiUrl) {
                            console.log('Using Gemini-generated image for:', article.title);
                            
                            // Pre-validate the image before showing
                            const img = new Image();
                            
                            // Set a timeout to handle stalled loads
                            const imageTimeout = setTimeout(() => {
                              console.log('Gemini image load timed out, using fallback for:', article.title);
                              img.onerror(new Error('Timeout'));
                            }, 5000);
                            
                            img.onload = () => {
                              clearTimeout(imageTimeout);
                              // Apply with fade-in effect
                              e.target.style.transition = 'opacity 0.5s ease-in-out';
                              e.target.style.opacity = 0;
                              setTimeout(() => {
                                e.target.src = `${geminiUrl}&t=${uniqueTimestamp}`;
                                e.target.style.opacity = 1;
                              }, 100);
                            };
                            
                            // If image fails, use premium fallback collection
                            img.onerror = () => {
                              clearTimeout(imageTimeout);
                              console.log('Gemini image failed to load, using premium collection for:', article.title);
                              
                              // Use category-specific backup image
                              const categoryBackups = getBackupImagesForCategory(article.category || 'Business', industry);
                              const backupIndex = getRotationIndex(article.title, categoryBackups.length);
                              const categoryBackup = categoryBackups[backupIndex];
                              
                              if (categoryBackup) {
                                console.log('Using category backup image:', categoryBackup);
                                // Apply with fade effect
                                e.target.style.transition = 'opacity 0.5s ease-in-out';
                                e.target.style.opacity = 0;
                                setTimeout(() => {
                                  e.target.src = categoryBackup;
                                  e.target.style.opacity = 1;
                                }, 100);
                              } else {
                                // Final fallback - use premium editorial collection
                                const premiumCollectionId = '3694365'; // Premium editorial collection
                                const premiumKeywords = encodeURIComponent(`premium,${industry},${article.category || ''}`);
                                const fallbackUrl = `https://source.unsplash.com/collection/${premiumCollectionId}/1600x900/?${premiumKeywords}&_=${uniqueTimestamp}`;
                                
                                e.target.style.transition = 'opacity 0.5s ease-in-out';
                                e.target.style.opacity = 0;
                                setTimeout(() => {
                                  e.target.src = fallbackUrl;
                                  e.target.style.opacity = 1;
                                }, 100);
                              }
                            };
                            
                            // Initiate image loading with unique timestamp
                            img.src = `${geminiUrl}&t=${uniqueTimestamp}`;
                          } else {
                            throw new Error('No Gemini URL returned');
                          }
                        } catch (error) {
                          console.error('Premium image loading error:', error);
                          
                          // Get category-specific backup image
                          const categoryBackup = getDefaultCategoryImage(article.category || 'Business', industry);
                          
                          if (categoryBackup) {
                            console.log('Using default category image:', categoryBackup);
                            e.target.src = categoryBackup;
                          } else {
                            // Final fallback - always use a curated professional collection
                            console.log('Using ultimate fallback professional collection');
                            const fallbackCollectionId = '1358248'; // Professional editorial collection
                            e.target.src = `https://source.unsplash.com/collection/${fallbackCollectionId}/1600x900?_=${Date.now()}`;
                          }
                        }
                      };
                      
                      // Start loading premium image immediately and catch any unexpected errors
                      loadPremiumImage().catch(err => {
                        console.error('Unhandled error in image loading:', err);
                        // Absolute fallback for any unexpected error
                        e.target.src = getDefaultIndustryImage(industry);
                      });
                    }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="overline" color="text.secondary">
                      {article.source} • {formatDate(article.published_date)}
                    </Typography>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {article.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {article.summary}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };
  
  // Render trending topics
  const renderTrendingTopics = () => {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" component="h3" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUpIcon sx={{ mr: 1 }} /> Trending Topics
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {trendingTopics.map((topic) => (
            <Chip 
              key={topic.id} 
              label={topic.name} 
              color="primary" 
              variant="outlined" 
              onClick={() => setSearchTerm(topic.name)}
              sx={{ mb: 1 }}
            />
          ))}
        </Box>
      </Paper>
    );
  };
  
  // Render upcoming events
  const renderUpcomingEvents = () => {
    return (
      <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" component="h3" gutterBottom color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <EventIcon sx={{ mr: 1 }} /> Upcoming Events
        </Typography>
        <List dense>
          {upcomingEvents.map((event) => (
            <ListItem key={event.id} sx={{ mb: 1 }}>
              <ListItemIcon sx={{ minWidth: '40px' }}>
                <CalendarTodayIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={event.name}
                secondary={
                  <span>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <CalendarTodayIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                      <Typography component="span" variant="body2" color="text.secondary">
                        {formatDate(event.start_date)} - {formatDate(event.end_date)}
                      </Typography>
                    </Box>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <LocationOnIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                      <Typography component="span" variant="body2" color="text.secondary">
                        {event.location}
                      </Typography>
                    </Box>
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <LinkIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                      <Link href={event.website} target="_blank" rel="noopener noreferrer" variant="body2">
                        Event Website
                      </Link>
                    </Box>
                  </span>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  };
  
  // Render news articles
  const renderArticles = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (articles.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No articles found matching your criteria.
          </Typography>
        </Box>
      );
    }
    
    return (
      <Grid container spacing={3}>
        {articles.map((article) => (
          <Grid item xs={12} key={article.id}>
            <Card sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, mb: 2 }}>
              <CardMedia
                component="img"
                sx={{ width: { xs: '100%', sm: 200 }, height: { xs: 200, sm: 'auto' } }}
                  src={getReliableImageUrl(article.image_url, article, industry)}
                  alt={article.title}
                  onError={(e) => {
                    console.log('Article image failed to load for:', article.title);
                    
                    // First, set a reliable placeholder while we get premium image
                    const tempPlaceholder = 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80';
                    e.target.src = tempPlaceholder;
                    
                    // Primarily use Gemini for high-quality images
                    const loadPremiumImage = async () => {
                      try {
                        // Use a timestamp to ensure we get a unique image
                        const uniqueTimestamp = Date.now();
                        
                        // Get premium Gemini image with unique timestamp
                        const geminiUrl = await getGeminiFallbackImageUrl(article, industry);
                        if (geminiUrl) {
                          console.log('Using Gemini-generated image for:', article.title);
                          
                          // Pre-validate the image before showing
                          const img = new Image();
                          
                          // Set a timeout to handle stalled loads
                          const imageTimeout = setTimeout(() => {
                            console.log('Gemini image load timed out, using fallback for:', article.title);
                            img.onerror(new Error('Timeout'));
                          }, 5000);
                          
                          img.onload = () => {
                            clearTimeout(imageTimeout);
                            // Apply with fade-in effect
                            e.target.style.transition = 'opacity 0.5s ease-in-out';
                            e.target.style.opacity = 0;
                            setTimeout(() => {
                              e.target.src = `${geminiUrl}&t=${uniqueTimestamp}`;
                              e.target.style.opacity = 1;
                            }, 100);
                          };
                          
                          // If image fails, use premium fallback collection
                          img.onerror = () => {
                            clearTimeout(imageTimeout);
                            console.log('Gemini image failed to load, using premium collection for:', article.title);
                            
                            // Use category-specific backup image
                            const categoryBackups = getBackupImagesForCategory(article.category || 'Business', industry);
                            const backupIndex = getRotationIndex(article.title, categoryBackups.length);
                            const categoryBackup = categoryBackups[backupIndex];
                            
                            if (categoryBackup) {
                              console.log('Using category backup image:', categoryBackup);
                              // Apply with fade effect
                              e.target.style.transition = 'opacity 0.5s ease-in-out';
                              e.target.style.opacity = 0;
                              setTimeout(() => {
                                e.target.src = categoryBackup;
                                e.target.style.opacity = 1;
                              }, 100);
                            } else {
                              // Final fallback - use premium editorial collection
                              const premiumCollectionId = '3694365'; // Premium editorial collection
                              const premiumKeywords = encodeURIComponent(`premium,${industry},${article.category || ''}`);
                              const fallbackUrl = `https://source.unsplash.com/collection/${premiumCollectionId}/1600x900/?${premiumKeywords}&_=${uniqueTimestamp}`;
                              
                              e.target.style.transition = 'opacity 0.5s ease-in-out';
                              e.target.style.opacity = 0;
                              setTimeout(() => {
                                e.target.src = fallbackUrl;
                                e.target.style.opacity = 1;
                              }, 100);
                            }
                          };
                          
                          // Initiate image loading with unique timestamp
                          img.src = `${geminiUrl}&t=${uniqueTimestamp}`;
                        } else {
                          throw new Error('No Gemini URL returned');
                        }
                      } catch (error) {
                        console.error('Premium image loading error:', error);
                        
                        // Get category-specific backup image
                        const categoryBackup = getDefaultCategoryImage(article.category || 'Business', industry);
                        
                        if (categoryBackup) {
                          console.log('Using default category image:', categoryBackup);
                          e.target.src = categoryBackup;
                        } else {
                          // Final fallback - always use a curated professional collection
                          console.log('Using ultimate fallback professional collection');
                          const fallbackCollectionId = '1358248'; // Professional editorial collection
                          e.target.src = `https://source.unsplash.com/collection/${fallbackCollectionId}/1600x900?_=${Date.now()}`;
                        }
                      }
                    };
                    
                    // Start loading premium image immediately and catch any unexpected errors
                    loadPremiumImage().catch(err => {
                      console.error('Unhandled error in image loading:', err);
                      // Absolute fallback for any unexpected error
                      e.target.src = getDefaultIndustryImage(industry);
                    });
                  }}
              />
              <CardContent sx={{ flex: '1 0 auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    {article.source} • {formatDate(article.published_date)}
                  </Typography>
                  <Chip 
                    label={article.category} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                    onClick={() => handleCategoryChange(article.category)}
                  />
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {article.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {article.summary}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    By {article.author}
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    color="primary" 
                    component="a" 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Read More
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };
  
  return (
    <Box>
      {/* Featured Articles */}
      {featuredArticles.length > 0 && renderFeaturedArticles()}
      
      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8} order={{ xs: 2, md: 1 }}>
          {/* Search and Filters */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search articles..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button 
                      variant="contained" 
                      color="primary" 
                      onClick={handleSearch}
                      disabled={loading}
                      size="small"
                      sx={{ display: { xs: 'none', sm: 'flex' } }}
                    >
                      Search
                    </Button>
                    <IconButton 
                      color="primary" 
                      onClick={handleSearch}
                      disabled={loading}
                      sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />
            
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 'bold', display: { xs: 'block', sm: 'none' } }}>
              Categories:
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1, 
                mb: 2,
                maxHeight: { xs: '100px', sm: 'none' },
                overflowY: { xs: 'auto', sm: 'visible' },
                pb: 1
              }}
            >
              <Chip 
                label="All Categories" 
                color={selectedCategory === 'All' ? 'primary' : 'default'} 
                onClick={() => handleCategoryChange('All')}
                sx={{ mr: 1 }}
                size="small"
              />
              {categories.map((category) => (
                <Chip
                  key={category.id}
                  label={category.category || category.name}
                  color={selectedCategory === (category.category || category.name) ? 'primary' : 'default'}
                  onClick={() => handleCategoryChange(category.category || category.name)}
                  sx={{ mr: 1 }}
                  size="small"
                />
              ))}
            </Box>
            
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 'bold', display: { xs: 'block', sm: 'none' } }}>
              Sources:
            </Typography>
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1,
                maxHeight: { xs: '100px', sm: 'none' },
                overflowY: { xs: 'auto', sm: 'visible' },
                pb: 1
              }}
            >
              <Chip 
                label="All Sources" 
                color={selectedSource === 'All' ? 'primary' : 'default'} 
                onClick={() => handleSourceChange('All')}
                sx={{ mr: 1 }}
                size="small"
              />
              {sources.map((source) => (
                <Chip
                  key={source.id}
                  label={source.source || source.name}
                  color={selectedSource === (source.source || source.name) ? 'primary' : 'default'}
                  onClick={() => handleSourceChange(source.source || source.name)}
                  sx={{ mr: 1 }}
                  size="small"
                />
              ))}
            </Box>
          </Box>
          
          {/* Articles List */}
          <Typography variant="h5" component="h2" gutterBottom color="primary" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <ArticleIcon sx={{ mr: 1 }} /> Latest News
          </Typography>
          {renderArticles()}
        </Grid>
        
        {/* Sidebar - Moved to top on mobile */}
        <Grid item xs={12} md={4} order={{ xs: 1, md: 2 }}>
          {/* Trending Topics */}
          {renderTrendingTopics()}
          
          {/* Upcoming Events */}
          {renderUpcomingEvents()}
        </Grid>
      </Grid>
    </Box>
  );
};

export default MarketNewsTab;
