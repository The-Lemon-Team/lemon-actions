import { bootstrapCoreShard } from './shard-bootstrap';

bootstrapCoreShard().catch((err) => {
  console.error('[CoreShard] Fatal startup error:', err);
  process.exit(1);
});
