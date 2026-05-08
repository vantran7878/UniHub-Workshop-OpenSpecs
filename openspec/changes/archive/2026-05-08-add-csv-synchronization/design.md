## Context

The UniHub Workshop system requires periodic synchronization of student data from a legacy CSV export provided by the university's central system. This involves handling large files (12,000+ rows) and ensuring data consistency without impacting the performance of the main API.

## Goals / Non-Goals

**Goals:**
- Implement a memory-efficient, streaming data pipeline.
- Ensure only one instance of the synchronization job runs at a time.
- Protect administrative and staff accounts from being modified by the synchronization process.
- Maintain a full audit trail of all synchronization attempts.

**Non-Goals:**
- Implementing a real-time web-based trigger for the synchronization (cron only).
- Supporting file formats other than CSV (e.g., Excel, JSON).

## Decisions

### Decision 1: Streaming CSV Parsing with `csv-parse`
- **Rationale**: Using a streaming parser allows the worker to process files of arbitrary size with a constant memory footprint (O(1) memory), which is essential for server stability.
- **Alternatives**: Loading the entire file into memory with `fs.readFileSync` was rejected due to memory overflow risks with large datasets.

### Decision 2: Concurrency Control with Redis Distributed Locking
- **Rationale**: Redis provides a reliable and lightweight mechanism to ensure mutual exclusion across multiple worker instances. A 5-minute (300s) TTL on the lock prevents deadlocks if a worker crashes.
- **Alternatives**: Database-level locking was considered but Redis is preferred for faster coordination and to avoid table-level contention during the lock acquisition phase.

### Decision 3: Batch Processing with PostgreSQL UPSERT
- **Rationale**: Processing updates in batches of 500 rows inside a single transaction balances database throughput with system responsiveness. Using `ON CONFLICT (student_id) DO UPDATE` ensures idempotency.
- **Alternatives**: Updating rows one-by-one was rejected due to the extreme overhead of individual database roundtrips.

### Decision 4: File Integrity Check with MD5 Hashing
- **Rationale**: Calculating a hash of the CSV file allows the system to skip processing if the file has not changed since the last successful run, saving significant CPU and I/O resources.
- **Alternatives**: Relying solely on the file modification time was rejected as it can be unreliable in certain file system configurations.

## Risks / Trade-offs

- **[Risk]**: The sync job takes longer than the 5-minute lock TTL → **[Mitigation]**: Implement telemetry to track execution time and alert if the job consistently approaches the TTL limit.
- **[Risk]**: Malformed CSV headers causing system failure → **[Mitigation]**: Implement a strict header validation phase before starting the streaming process.
- **[Risk]**: Soft-deleting active students due to a partial CSV export → **[Mitigation]**: The soft-delete phase only runs if the entire CSV has been processed successfully (atomicity at the job level).
