import { Context } from 'hono';
import { exportD1ToR2 } from '../d1_backup';

export default {
    // POST /admin/backup
    // Manually trigger a D1 -> R2 backup. Useful for testing or for admins
    // who want an on-demand snapshot before/after a risky operation.
    runBackup: async (c: Context<HonoCustomType>) => {
        const result = await exportD1ToR2(c.env);
        if (!result.success) {
            return c.json({ success: false, error: result.error }, 500);
        }
        return c.json({
            success: true,
            key: result.key,
            bytes: result.bytes,
            tables: result.tables,
            rows: result.rows,
            durationMs: result.durationMs,
        });
    },
};
