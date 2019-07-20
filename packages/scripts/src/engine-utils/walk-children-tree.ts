/**
 * walk on recursive tree and collect results (level by level algorithm).
 * @param root any recursive type
 * @param predicate should add to results function
 * @param processModule process modules that match predicate
 * @param results: Set of items that match the predicate and processModule
 * @param visited: internal set of visited items
 */
export function walkChildrenTreeByDepth<
    A extends {
        children: A[];
    },
    T
>(
    root: A,
    predicate: (m: A) => boolean,
    processModule: (m: A) => T,
    results = new Set<T>(),
    visited = new Set<A>()
): Set<T> {
    const toVisit: A[] = [root];
    while (toVisit.length) {
        const m = toVisit.shift()!;
        if (visited.has(m)) {
            continue;
        }
        visited.add(m);
        if (predicate(m)) {
            results.add(processModule(m));
        }
        toVisit.push(...m.children);
    }
    return results;
}

/**
 * walk on recursive tree and collect results (recursive algorithm).
 * @param root any recursive type
 * @param predicate should add to results function
 * @param processModule process modules that match predicate
 * @param results: Set of items that match the predicate and processModule
 * @param visited: internal set of visited items
 */
export function walkChildrenTree<
    A extends {
        children: A[];
    },
    T
>(
    root: A,
    predicate: (m: A) => boolean,
    processModule: (m: A) => T,
    results = new Set<T>(),
    visited = new Set<A>()
): Set<T> {
    if (visited.has(root)) {
        return results;
    }
    visited.add(root);
    if (predicate(root)) {
        results.add(processModule(root));
    }
    for (const childModule of root.children) {
        walkChildrenTree(childModule, predicate, processModule, results);
    }
    return results;
}
