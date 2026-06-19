async function anilistQuery(query, variables) {
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
        if (retry.ok) return retry.json();
        return { data: null };
    }
    return res.json();
}

module.exports = { anilistQuery };
