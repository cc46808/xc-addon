const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

const manifest = {
    id: 'com.stremio.xc-addon',
    version: '1.0.0',
    name: 'Xtream Code Addon',
    description: 'Stremio addon to parse and play Xtream Code (XC) URLs for live TV, movies, and series.',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [
        {
            type: 'movie',
            id: 'xc-movies',
            name: 'XC Movies'
        }
    ],
    idPrefixes: ['xc:']
};

// Mock catalog data – replace with real Xtream Code API calls when integrating
// a live XC server (e.g. fetch from http://<host>/player_api.php?username=...&action=get_vod_streams).
const CATALOG = [
    {
        id: 'xc:1',
        name: 'Sample Movie',
        type: 'movie',
        poster: 'https://example.com/sample-movie.jpg'  // replace with real poster URL
    }
];

// Mock stream map – replace with a real XC stream URL built from the item ID and your credentials.
const STREAMS = {
    'xc:1': 'http://example.com/stream/1'  // replace with real XC stream URL
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(({ type, id }) => {
    if (type === 'movie' && id === 'xc-movies') {
        return Promise.resolve({ metas: CATALOG });
    }
    return Promise.resolve({ metas: [] });
});

builder.defineStreamHandler(({ type, id }) => {
    if (type === 'movie' && STREAMS[id]) {
        return Promise.resolve({
            streams: [
                {
                    url: STREAMS[id],
                    title: 'Xtream Code Stream'
                }
            ]
        });
    }
    return Promise.resolve({ streams: [] });
});

const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`Xtream Code Addon running on port ${PORT}`);
console.log(`Manifest available at http://localhost:${PORT}/manifest.json`);
