// D1 auto-backup to R2
//
// Generates a SQL dump of the core tables and uploads it to the R2 bucket
// bound to env.BACKUP. Triggered by the Worker scheduled handler (cron "0 0 * * *")
// and optionally by the admin endpoint POST /admin/backup.
//
// Restore procedure (manual):
//   1. wrangler d1 execute temp-email-db --file=db/schema.sql --remote   # ensure schema
//   2. wrangler d1 execute temp-email-db --file=<r2-key> --remote        # replay INSERTs
//
// The SQL file is data-only. Schema lives in db/schema.sql and is applied
// via the Worker's existing migration flow on startup.

const TABLES_TO_BACKUP = [
    'address',
    'raw_mails',
    'auto_reply_mails',
    'address_sender',
    'sendbox',
    'settings',
    'users',
    'users_address',
    'user_roles',
    'user_passkeys',
];

const bytesToHex = (bytes: Uint8Array): string => {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
};

const escapeSqlString = (val: string): string =>
    val.replace(/'/g, "''");

const formatSqlValue = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'number') {
        if (!Number.isFinite(val)) return 'NULL';
        return String(val);
    }
    if (typeof val === 'bigint') return String(val);
    if (val instanceof ArrayBuffer) {
        return `X'${bytesToHex(new Uint8Array(val))}'`;
    }
    if (val instanceof Uint8Array) {
        return `X'${bytesToHex(val)}'`;
    }
    if (typeof val === 'object') {
        return `'${escapeSqlString(JSON.stringify(val))}'`;
    }
    return `'${escapeSqlString(String(val))}'`;
};

export interface BackupResult {
    success: boolean;
    key?: string;
    bytes?: number;
    tables?: number;
    rows?: number;
    error?: string;
    durationMs?: number;
}

export async function exportD1ToR2(env: Bindings): Promise<BackupResult> {
    const start = Date.now();
    try {
        if (!env.BACKUP) {
            throw new Error('R2 BACKUP binding is not configured');
        }

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
        const key = `backup-${dateStr}.sql`;

        const header = [
            `-- D1 backup generated ${now.toISOString()}`,
            `-- Database: temp-email-db`,
            `-- Generator: cloudflare_temp_email worker (exportD1ToR2)`,
            `-- Tables: ${TABLES_TO_BACKUP.join(', ')}`,
            '',
            'BEGIN TRANSACTION;',
            '',
        ].join('\n');

        const lines: string[] = [];
        let totalRows = 0;
        let successfulTables = 0;

        for (const table of TABLES_TO_BACKUP) {
            try {
                const { results: colInfo } = await env.DB.prepare(
                    `PRAGMA table_info(${table})`
                ).all<{ name: string }>();

                if (!colInfo || colInfo.length === 0) {
                    lines.push(`-- Skipped ${table}: table does not exist`);
                    lines.push('');
                    continue;
                }

                const columns = colInfo.map((c) => c.name);
                const { results: rows } = await env.DB.prepare(
                    `SELECT * FROM ${table}`
                ).all<Record<string, any>>();

                const rowCount = rows ? rows.length : 0;
                lines.push(`-- Table ${table}: ${rowCount} row(s)`);

                if (rowCount === 0) {
                    lines.push('');
                    continue;
                }

                for (const row of rows) {
                    const values = columns.map((col) => formatSqlValue(row[col]));
                    lines.push(
                        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`
                    );
                }
                totalRows += rowCount;
                successfulTables += 1;
                lines.push('');
            } catch (e) {
                const err = e as Error;
                lines.push(`-- Error backing up table ${table}: ${err.message}`);
                lines.push('');
                console.error(`[d1_backup] Failed table ${table}:`, err);
            }
        }

        const footer = 'COMMIT;\n';
        const fullSql = header + lines.join('\n') + footer;

        await env.BACKUP.put(key, fullSql, {
            httpMetadata: { contentType: 'application/sql; charset=utf-8' },
            customMetadata: {
                tables: String(successfulTables),
                rows: String(totalRows),
                generatedAt: now.toISOString(),
            },
        });

        const durationMs = Date.now() - start;
        console.log(
            `[d1_backup] OK key=${key} bytes=${fullSql.length} ` +
            `tables=${successfulTables}/${TABLES_TO_BACKUP.length} rows=${totalRows} ` +
            `durationMs=${durationMs}`
        );

        return {
            success: true,
            key,
            bytes: fullSql.length,
            tables: successfulTables,
            rows: totalRows,
            durationMs,
        };
    } catch (e) {
        const err = e as Error;
        console.error('[d1_backup] Failed:', err);
        return { success: false, error: err.message };
    }
}
