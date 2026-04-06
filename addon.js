const express = require('express');
const { addonBuilder, getRouter } = require('stremio-addon-sdk');

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

function renderConfigPage(origin) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Xtream Code Addon Setup</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f4efe4;
            --panel: #fffaf1;
            --text: #172126;
            --muted: #5e6b70;
            --accent: #0f766e;
            --accent-strong: #115e59;
            --border: #d8ccb8;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: Georgia, 'Times New Roman', serif;
            background:
                radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 30%),
                radial-gradient(circle at bottom right, rgba(180, 83, 9, 0.12), transparent 28%),
                var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .card {
            width: min(760px, 100%);
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 24px;
            box-shadow: 0 18px 50px rgba(23, 33, 38, 0.12);
            padding: 32px;
        }

        h1 {
            margin: 0 0 12px;
            font-size: clamp(2rem, 5vw, 3.3rem);
            line-height: 1;
        }

        p {
            margin: 0;
            color: var(--muted);
            font-size: 1.05rem;
            line-height: 1.6;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-top: 28px;
        }

        .field {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .field.full {
            grid-column: 1 / -1;
        }

        label {
            font-size: 0.95rem;
            font-weight: 700;
            color: var(--text);
        }

        input {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px 16px;
            font: inherit;
            background: #fff;
            color: var(--text);
        }

        input:focus {
            outline: 2px solid rgba(15, 118, 110, 0.18);
            border-color: var(--accent);
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 24px;
        }

        .button {
            appearance: none;
            border: 0;
            border-radius: 999px;
            padding: 14px 20px;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .button:hover {
            transform: translateY(-1px);
        }

        .button.primary {
            background: var(--accent);
            color: #fff;
        }

        .button.secondary {
            background: transparent;
            color: var(--accent-strong);
            border: 1px solid var(--border);
        }

        .output {
            margin-top: 28px;
            padding: 18px;
            border-radius: 18px;
            background: #fff;
            border: 1px solid var(--border);
        }

        .output h2 {
            margin: 0 0 10px;
            font-size: 1rem;
        }

        .output code {
            display: block;
            overflow-wrap: anywhere;
            padding: 12px;
            border-radius: 12px;
            background: #f7f2e9;
            color: #19343b;
            font-family: 'Cascadia Code', Consolas, monospace;
            font-size: 0.92rem;
        }

        .note {
            margin-top: 14px;
            font-size: 0.92rem;
        }

        @media (max-width: 640px) {
            .card {
                padding: 22px;
                border-radius: 18px;
            }
        }
    </style>
</head>
<body>
    <main class="card">
        <h1>Configure XC Addon</h1>
        <p>Enter your Xtream Code server details below. This page generates a private addon manifest URL tied to your credentials and gives you a Stremio install link directly from this domain.</p>

        <form id="configForm" class="grid">
            <div class="field full">
                <label for="serverUrl">XC Server URL</label>
                <input id="serverUrl" name="serverUrl" type="text" placeholder="https://provider.example.com" required>
            </div>
            <div class="field">
                <label for="username">Username</label>
                <input id="username" name="username" type="text" placeholder="your-username" required>
            </div>
            <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" placeholder="your-password" required>
            </div>
        </form>

        <div class="actions">
            <a id="installLink" class="button primary" href="#">Install In Stremio</a>
            <a id="manifestLink" class="button secondary" href="#" target="_blank" rel="noreferrer">Open Manifest URL</a>
        </div>

        <section class="output">
            <h2>Generated Manifest URL</h2>
            <code id="manifestUrl"></code>
            <p class="note">If Stremio does not open automatically, copy the manifest URL above into Stremio's addon installer.</p>
        </section>
    </main>

    <script>
        const form = document.getElementById('configForm');
        const installLink = document.getElementById('installLink');
        const manifestLink = document.getElementById('manifestLink');
        const manifestUrlNode = document.getElementById('manifestUrl');
        const origin = ${JSON.stringify(origin)};

        function buildManifestUrl() {
            const formData = new FormData(form);
            const config = Object.fromEntries(formData.entries());
            const encoded = encodeURIComponent(JSON.stringify(config));
            return origin + '/' + encoded + '/manifest.json';
        }

        function updateLinks() {
            const manifestUrl = buildManifestUrl();
            manifestUrlNode.textContent = manifestUrl;
            manifestLink.href = manifestUrl;
            installLink.href = 'stremio://' + manifestUrl.replace(/^https?:\/\//, '');
        }

        installLink.addEventListener('click', event => {
            if (!form.reportValidity()) {
                event.preventDefault();
                return;
            }

            updateLinks();
        });

        form.addEventListener('input', updateLinks);
        updateLinks();
    </script>
</body>
</html>`;
}

const PORT = process.env.PORT || 7000;

const addonInterface = builder.getInterface();
const addonRouter = getRouter(addonInterface);
const app = express();

app.get(['/', '/configure'], (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderConfigPage(origin));
});

app.use(addonRouter);

app.listen(PORT, () => {
    console.log(`Xtream Code Addon running on port ${PORT}`);
    console.log(`Manifest available at http://localhost:${PORT}/manifest.json`);
    console.log(`Configure at http://localhost:${PORT}/`);
});
