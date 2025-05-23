# Market Insights Dashboard

This repository contains a comprehensive dashboard for market analysis and insights in the dental and aesthetic industries.

## Features

- Interactive dashboard with multiple tabs for different data views
- Real-time data from Supabase
- MCP (Model Context Protocol) integration for enhanced data access
- Responsive design for desktop and mobile
- Dark/light mode toggle

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- Supabase account and project

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/BoweryJG/market_insights.git
   cd market_insights
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your credentials:
   ```
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Backend API Configuration
   VITE_API_BASE_URL=https://osbackend-zl1h.onrender.com
   ```

### Running the Application

#### Standard Development Mode

```
npm run dev
```

#### With MCP Integration

The application supports Model Context Protocol (MCP) for enhanced Supabase integration. To run with MCP:

```
npm run dev-with-mcp
```

This will start both the MCP server and the development server concurrently.

### Data Management

#### Loading Initial Data

To populate your Supabase database with initial data:

```
npm run load-data
```

#### Refreshing Supabase Data

To ensure the application is using live data from Supabase (not mock data), you can refresh all Supabase tables with:

```
npm run refresh-supabase
```

Or use the npm script:

```
npm run refresh-all-data
```

Or run the shell script directly:

```
./refresh-all-data.sh
```

These scripts will:
1. Clear all existing data in Supabase tables
2. Reload fresh data from source files
3. Ensure all dental and aesthetic procedures, companies, and market data are properly populated
4. Fetch and populate news articles from external sources

Use these commands whenever you need to reset the database or ensure you're working with the latest data. The application will now use live data from Supabase for:
- Dental procedures
- Aesthetic procedures
- Dental companies
- Aesthetic companies
- Market growth data
- Demographics data
- Metropolitan markets
- News articles

No mock data will be used after running these refresh scripts.

## MCP Integration

The application uses Model Context Protocol (MCP) to connect to Supabase. The MCP configuration is stored in `mcp-config.json`.

To start only the MCP server:

```
npm run start-mcp
```

## Project Structure

- `src/components/` - React components
- `src/services/` - Service modules for data fetching and business logic
- `src/services/supabase/` - Supabase integration
- `src/data/` - Static data files

## License

ISC
