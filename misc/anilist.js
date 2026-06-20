const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getCacheKey(query, variables) {
    return JSON.stringify({ q: query.replace(/\s+/g, ' ').trim(), v: variables });
}

async function anilistQuery(query, variables) {
    const key = getCacheKey(query, variables);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }

    const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after')) || 1;
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        const retry = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        if (retry.ok) {
            const data = await retry.json();
            cache.set(key, { data, time: Date.now() });
            return data;
        }
        return { data: null };
    }
    const data = await res.json();
    cache.set(key, { data, time: Date.now() });
    return data;
}

module.exports = { anilistQuery };
