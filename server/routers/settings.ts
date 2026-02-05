import { z } from "zod";
import { router, superAdminProcedure } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { siteSettings, subscriptionPlans } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

export const siteRouter = router({
  // ============================================================================
  // SITE SETTINGS
  // ============================================================================

  getSiteSettings: superAdminProcedure.query(async () => {
    const db = await getDb();
    const settings = await db.select().from(siteSettings).limit(1);
    return settings[0] || null;
  }),

  updateSiteSettings: superAdminProcedure
    .input(
      z.object({
        siteName: z.string().optional(),
        siteNameAr: z.string().optional(),
        tagline: z.string().optional(),
        taglineAr: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        faviconUrl: z.string().nullable().optional(),
        heroTitle: z.string().optional(),
        heroTitleAr: z.string().optional(),
        heroSubtitle: z.string().optional(),
        heroSubtitleAr: z.string().optional(),
        heroDescription: z.string().optional(),
        heroDescriptionAr: z.string().optional(),
        uptimePercent: z.string().optional(),
        activeClients: z.string().optional(),
        managedCards: z.string().optional(),
        supportHours: z.string().optional(),
        supportEmail: z.string().optional(),
        supportPhone: z.string().optional(),
        supportHoursText: z.string().optional(),
        supportHoursTextAr: z.string().optional(),
        companyName: z.string().optional(),
        companyNameAr: z.string().optional(),
        copyrightText: z.string().optional(),
        copyrightTextAr: z.string().optional(),
        facebookUrl: z.string().nullable().optional(),
        twitterUrl: z.string().nullable().optional(),
        linkedinUrl: z.string().nullable().optional(),
        instagramUrl: z.string().nullable().optional(),
        metaTitle: z.string().optional(),
        metaTitleAr: z.string().optional(),
        metaDescription: z.string().nullable().optional(),
        metaDescriptionAr: z.string().nullable().optional(),
        metaKeywords: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      // Check if settings exist
      const existing = await db.select().from(siteSettings).limit(1);
      
      if (existing.length === 0) {
        // Insert new settings
        await db.insert(siteSettings).values(input as any);
      } else {
        // Update existing settings
        await db.update(siteSettings)
          .set(input as any)
          .where(eq(siteSettings.id, existing[0].id));
      }
      
      return { success: true };
    }),

  // ============================================================================
  // SUBSCRIPTION PLANS
  // ============================================================================

  listSubscriptionPlans: superAdminProcedure.query(async () => {
    const db = await getDb();
    return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.displayOrder);
  }),

  getSubscriptionPlan: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const plans = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.id))
        .limit(1);
      return plans[0] || null;
    }),

  createSubscriptionPlan: superAdminProcedure
    .input(
      z.object({
        name: z.string(),
        nameAr: z.string(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number(),
        currency: z.string().default("USD"),
        billingPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
        features: z.array(z.string()),
        featuresAr: z.array(z.string()),
        maxCards: z.number().optional(),
        maxNasDevices: z.number().optional(),
        maxResellers: z.number().optional(),
        isPopular: z.boolean().default(false),
        displayOrder: z.number().default(0),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(subscriptionPlans).values({
        ...input,
        features: input.features as any,
        featuresAr: input.featuresAr as any,
      });
      return { id: Number(result.insertId), success: true };
    }),

  updateSubscriptionPlan: superAdminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        nameAr: z.string().optional(),
        description: z.string().optional(),
        descriptionAr: z.string().optional(),
        price: z.number().optional(),
        currency: z.string().optional(),
        billingPeriod: z.enum(["monthly", "yearly"]).optional(),
        features: z.array(z.string()).optional(),
        featuresAr: z.array(z.string()).optional(),
        maxCards: z.number().optional(),
        maxNasDevices: z.number().optional(),
        maxResellers: z.number().optional(),
        isPopular: z.boolean().optional(),
        displayOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...updates } = input;
      
      // Convert arrays to JSON if provided
      const updateData: any = { ...updates };
      if (updates.features) {
        updateData.features = updates.features as any;
      }
      if (updates.featuresAr) {
        updateData.featuresAr = updates.featuresAr as any;
      }
      
      await db.update(subscriptionPlans)
        .set(updateData)
        .where(eq(subscriptionPlans.id, id));
      
      return { success: true };
    }),

  deleteSubscriptionPlan: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, input.id));
      return { success: true };
    }),
});
