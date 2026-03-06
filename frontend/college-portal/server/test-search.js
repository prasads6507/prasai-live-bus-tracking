const { db, initializationError } = require('./config/firebase');

async function testSearch(query) {
    if (initializationError) {
        console.error('Initialization Error:', initializationError.message);
        return;
    }
    try {
        const collegesRef = db.collection('colleges');
        const snapshot = await collegesRef.where('status', '==', 'ACTIVE').get();

        console.log(`Searching for: "${query}"`);
        const colleges = snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    collegeId: data.collegeId,
                    collegeName: data.collegeName || data.name,
                    slug: data.slug,
                    status: data.status
                };
            })
            .filter(c => {
                const name = (c.collegeName || '').toLowerCase();
                const slug = (c.slug || '').toLowerCase();
                const q = query.toLowerCase();
                return name.includes(q) || slug.includes(q);
            });

        console.log('Results:', JSON.stringify(colleges, null, 2));
    } catch (error) {
        console.error('Search failed:', error.stack);
    }
}

testSearch('sist');
