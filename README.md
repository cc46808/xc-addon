# Xtream Code Addon for Stremio

A [Stremio](https://www.stremio.com/) addon that parses and plays Xtream Code (XC) URLs to provide streams for live TV, movies, and series.

## Features

- **Catalog Handler** – Returns a movie catalog sourced from Xtream Code.
- **Stream Handler** – Maps a catalog item ID to its Xtream Code stream URL.
- Listens on `PORT` environment variable (default: `7000`).
- Exposes `/manifest.json` as required by Stremio.

## Requirements

- [Node.js](https://nodejs.org/) v20 or later
- npm

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/cc46808/xc-addon.git
cd xc-addon

# 2. Install dependencies
npm install

# 3. Start the addon
npm start
```

The addon will be available at `http://localhost:7000`.

## Testing

Open the following URLs in a browser or with `curl` to verify the addon is working:

| Endpoint | Description |
|---|---|
| `http://localhost:7000/manifest.json` | Addon manifest |
| `http://localhost:7000/catalog/movie/xc-movies.json` | Movie catalog |
| `http://localhost:7000/stream/movie/xc:1.json` | Stream for item `xc:1` |

To add the addon to Stremio, open:

```
http://localhost:7000/manifest.json
```

in the Stremio app (Settings → Addons → Add addon).

## Deploy with Docker

```bash
# Build the image
docker build -t xc-addon .

# Run the container
docker run -p 7000:7000 xc-addon
```

## Deploy with BeamUp

[BeamUp](https://github.com/Stremio/stremio-beamup) is Stremio's free hosting service for addons.

### Initial Setup

```bash
# Install beamup-cli globally
npm install -g beamup-cli

# Log in / register (follow the interactive prompts)
beamup
```

### Deploy

From the project root:

```bash
beamup
```

BeamUp will build and host the addon and return a public HTTPS URL, e.g.:
`https://<your-id>.beamup.dev/manifest.json`

Use that URL to install the addon in Stremio or submit it to the
[Stremio Addon Central](https://stremio-addon-manager.now.sh/).

## Project Structure

```
xc-addon/
├── addon.js        # Main addon code (manifest, catalog & stream handlers)
├── package.json    # Node.js project metadata and dependencies
├── Dockerfile      # Docker image for containerised deployment
└── README.md       # This file
```

## License

MIT
