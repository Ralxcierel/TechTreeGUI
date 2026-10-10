// Test fixtures, loaded as raw text through Vite's `?raw` import.
import fiveNodesRaw from './five-nodes.json?raw'
import fiveNodesV2Raw from './five-nodes-v2.json?raw'

/** A valid 5-node, 4-edge document in canonical form (as `serialize` writes it). */
// Line endings normalised so tests don't depend on git's CRLF conversion on Windows checkouts.
export const FIVE_NODES = fiveNodesRaw.replace(/\r\n/g, '\n')

/** The same document as saved by schema v2 (before named handles), for the v2 → v3 migration. */
export const FIVE_NODES_V2 = fiveNodesV2Raw.replace(/\r\n/g, '\n')
