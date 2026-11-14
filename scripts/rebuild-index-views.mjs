import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.json', import.meta.url);
const index = JSON.parse(await readFile(indexUrl, 'utf8'));

function groupBy(works, property, fallback) {
    const groups = {};
    for (const work of works) {
        const values = Array.isArray(work[property])
            ? work[property]
            : [work[property] ?? fallback];
        for (const value of values) {
            if (value === undefined) continue;
            (groups[value] ??= []).push(work.id);
        }
    }
    return groups;
}

index.machine_views = {
    works_by_type: groupBy(index.works, 'type'),
    works_by_subtype: groupBy(index.works, 'subtype'),
    works_by_publication_context: groupBy(index.works, 'published_in'),
    works_by_year: groupBy(index.works, 'year', 'undated'),
    tag_index: groupBy(index.works, 'tags'),
};

await writeFile(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
console.log(`Rebuilt five views from ${index.works.length} works.`);
