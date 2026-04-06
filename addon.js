const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');

const manifest = {
    id: 'com.stremio.xc-addon',
    version: '1.0.0',
    name: 'Xtream Code Addon',
    description: 'Stremio addon for Xtream Code providers with per-user server credentials.',
    resources: ['catalog', 'stream'],
    types: ['movie'],
    catalogs: [
        {
            type: 'movie',
            id: 'xc-movies',
            name: 'XC Movies'
        }
    ],
    idPrefixes: ['xc:'],
    behaviorHints: {
        configurable: true,
        configurationRequired: true
    },
    config: [
        {
            key: 'serverUrl',
            type: 'text',
            title: 'XC Server URL',
            required: true
        },
        {
            key: 'username',
            type: 'text',
            title: 'Username',
            required: true
        },
        {
            key: 'password',
            type: 'password',
            title: 'Password',
            required: true
        }
    ]
};

function normalizeServerUrl(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') {
        return null;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawValue.trim());
    } catch {
        return null;
    }

    const path = parsedUrl.pathname.replace(/\/$/, '');
    if (path.endsWith('/get.php') || path.endsWith('/player_api.php') || path.endsWith('/xmltv.php')) {
        parsedUrl.pathname = path.slice(0, path.lastIndexOf('/')) || '/';
    }

    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.toString().replace(/\/$/, '');
}

function resolveConfig(config) {
    if (!config || typeof config !== 'object') {
        return null;
    }

    const rawUrl = typeof config.serverUrl === 'string' ? config.serverUrl.trim() : '';
    let parsedInput = null;
    if (rawUrl) {
        try {
            parsedInput = new URL(rawUrl);
        } catch {
            parsedInput = null;
        }
    }
    const serverUrl = normalizeServerUrl(rawUrl);
    const username = (config.username || parsedInput?.searchParams.get('username') || '').trim();
    const password = (config.password || parsedInput?.searchParams.get('password') || '').trim();

    if (!serverUrl || !username || !password) {
        return null;
    }

    return { serverUrl, username, password };
}

function buildXtreamUrl(baseUrl, pathName, params = {}) {
    const url = new URL(baseUrl);
    const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');

    url.pathname = `${basePath}/${pathName.replace(/^\//, '')}`;
    url.search = '';

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

async function fetchXtreamJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Xtream API request failed with status ${response.status}`);
    }

    return response.json();
}

function toMeta(stream) {
    const extension = stream.container_extension || 'mp4';

    return {
        id: `xc:${stream.stream_id}:${extension}`,
        type: 'movie',
        name: stream.name || `Movie ${stream.stream_id}`,
        poster: stream.stream_icon || undefined,
        posterShape: 'poster'
    };
}

function parseStreamId(id) {
    const match = /^xc:(\d+):([a-z0-9]+)$/i.exec(id || '');
    if (!match) {
        return null;
    }

    return {
        streamId: match[1],
        extension: match[2]
    };
}

async function getVodStreams(config) {
    const playerApiUrl = buildXtreamUrl(config.serverUrl, '/player_api.php', {
        username: config.username,
        password: config.password,
        action: 'get_vod_streams'
    });

    const result = await fetchXtreamJson(playerApiUrl);
    return Array.isArray(result) ? result : [];
}

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, config }) => {
    if (type !== 'movie' || id !== 'xc-movies') {
        return { metas: [] };
    }

    const resolvedConfig = resolveConfig(config);
    if (!resolvedConfig) {
        return { metas: [] };
    }

    try {
        const vodStreams = await getVodStreams(resolvedConfig);
        return {
            metas: vodStreams
                .filter(stream => stream && stream.stream_id)
                .map(toMeta)
        };
    } catch (error) {
        console.error('Failed to load Xtream catalog:', error.message);
        return { metas: [] };
    }
});

builder.defineStreamHandler(({ type, id, config }) => {
    if (type !== 'movie') {
        return Promise.resolve({ streams: [] });
    }

    const resolvedConfig = resolveConfig(config);
    const parsedStream = parseStreamId(id);
    if (!resolvedConfig || !parsedStream) {
        return Promise.resolve({ streams: [] });
    }

    const streamUrl = buildXtreamUrl(
        resolvedConfig.serverUrl,
        `/movie/${resolvedConfig.username}/${resolvedConfig.password}/${parsedStream.streamId}.${parsedStream.extension}`
    );

    return Promise.resolve({
        streams: [
            {
                url: streamUrl,
                title: 'Xtream Code Stream'
            }
        ]
    });
});

const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`Xtream Code Addon running on port ${PORT}`);
console.log(`Manifest available at http://localhost:${PORT}/manifest.json`);
