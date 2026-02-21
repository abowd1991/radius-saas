import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  /**
   * Reload FreeRADIUS to sync NAS clients from database
   * Called after NAS create/update/delete operations
   */
  reloadFreeRADIUS: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        const response = await fetch(`${ENV.VPS_MANAGEMENT_URL}/api/reload-freeradius`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': ENV.VPS_MANAGEMENT_API_KEY,
          },
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('[reloadFreeRADIUS] Failed:', error);
          return {
            success: false,
            error: `VPS API returned ${response.status}: ${error}`,
          };
        }

        const result = await response.json();
        console.log('[reloadFreeRADIUS] Success:', result);
        return {
          success: true,
          message: 'FreeRADIUS reloaded successfully',
        };
      } catch (error: any) {
        console.error('[reloadFreeRADIUS] Exception:', error);
        return {
          success: false,
          error: error.message || 'Unknown error',
        };
      }
    }),
});
