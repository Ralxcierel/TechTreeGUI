// Test fixtures, loaded as raw text through Vite's `?raw` import.
import fiveNodesRaw from './five-nodes.json?raw'

/** A valid 5-node, 4-edge document in canonical form (as `serialize` writes it). */
// Line endings normalised so tests don't depend on git's CRLF conversion on Windows checkouts.
export const FIVE_NODES = fiveNodesRaw.replace(/\r\n/g, '\n')
