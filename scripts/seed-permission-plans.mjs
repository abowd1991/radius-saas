import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// ============================================================================
// PERMISSION GROUPS SEED DATA
// ============================================================================

const permissionGroups = [
  {
    name: "client_management",
    nameAr: "إدارة العملاء",
    description: "Manage clients and users",
    descriptionAr: "إدارة العملاء والمستخدمين",
    menuItems: ["/clients", "/users-management"],
    applicableRoles: ["owner", "reseller"]
  },
  {
    name: "cards_vouchers",
    nameAr: "البطاقات والكروت",
    description: "Manage cards, vouchers, and batches",
    descriptionAr: "إدارة البطاقات والكروت والدفعات",
    menuItems: ["/cards", "/card-batches", "/card-templates"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "reports_analytics",
    nameAr: "التقارير والتحليلات",
    description: "View reports and analytics",
    descriptionAr: "عرض التقارير والتحليلات",
    menuItems: ["/reports", "/analytics"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "billing_finance",
    nameAr: "المالية والفوترة",
    description: "Manage billing, invoices, and wallet",
    descriptionAr: "إدارة الفوترة والفواتير والمحفظة",
    menuItems: ["/owner-billing", "/invoices", "/wallet", "/wallet-ledger", "/tenant-subscriptions"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "infrastructure_nas",
    nameAr: "البنية التحتية (NAS)",
    description: "Manage NAS devices and network infrastructure",
    descriptionAr: "إدارة أجهزة NAS والبنية التحتية للشبكة",
    menuItems: ["/nas", "/nas-health"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "vpn_management",
    nameAr: "إدارة VPN",
    description: "Manage VPN connections and IP pools",
    descriptionAr: "إدارة اتصالات VPN ومجموعات IP",
    menuItems: ["/vpn", "/vpn-logs", "/vpn-ip-pool"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "network_management",
    nameAr: "إدارة الشبكات",
    description: "Manage internet plans, subscribers, and sessions",
    descriptionAr: "إدارة خطط الإنترنت والمشتركين والجلسات",
    menuItems: ["/plans", "/subscribers", "/active-sessions", "/subscriber-subscriptions"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "support_tickets",
    nameAr: "الدعم الفني",
    description: "Manage support tickets",
    descriptionAr: "إدارة تذاكر الدعم الفني",
    menuItems: ["/tickets"],
    applicableRoles: ["owner", "reseller", "client"]
  },
  {
    name: "system_settings",
    nameAr: "إعدادات النظام",
    description: "System settings and configurations",
    descriptionAr: "إعدادات وتكوينات النظام",
    menuItems: ["/settings", "/system-settings"],
    applicableRoles: ["owner"]
  },
  {
    name: "advanced_features",
    nameAr: "الميزات المتقدمة",
    description: "Advanced features like RADIUS control, logs, backups",
    descriptionAr: "الميزات المتقدمة مثل التحكم في RADIUS والسجلات والنسخ الاحتياطي",
    menuItems: ["/radius-control", "/radius-logs", "/backups", "/audit-logs"],
    applicableRoles: ["owner", "reseller"]
  }
];

// ============================================================================
// PERMISSION PLANS SEED DATA
// ============================================================================

const permissionPlans = [
  {
    name: "Basic Client",
    nameAr: "عميل أساسي",
    description: "Basic plan for clients with essential features",
    descriptionAr: "خطة أساسية للعملاء مع الميزات الأساسية",
    role: "client",
    isDefault: true,
    isActive: true,
    groups: ["cards_vouchers", "network_management", "support_tickets"]
  },
  {
    name: "Pro Client",
    nameAr: "عميل محترف",
    description: "Professional plan for clients with advanced features",
    descriptionAr: "خطة احترافية للعملاء مع ميزات متقدمة",
    role: "client",
    isDefault: false,
    isActive: true,
    groups: ["cards_vouchers", "reports_analytics", "billing_finance", "infrastructure_nas", "vpn_management", "network_management", "support_tickets"]
  },
  {
    name: "Reseller Basic",
    nameAr: "موزع أساسي",
    description: "Basic plan for resellers",
    descriptionAr: "خطة أساسية للموزعين",
    role: "reseller",
    isDefault: true,
    isActive: true,
    groups: ["client_management", "cards_vouchers", "network_management", "support_tickets"]
  },
  {
    name: "Reseller Pro",
    nameAr: "موزع محترف",
    description: "Professional plan for resellers with all features",
    descriptionAr: "خطة احترافية للموزعين مع جميع الميزات",
    role: "reseller",
    isDefault: false,
    isActive: true,
    groups: ["client_management", "cards_vouchers", "reports_analytics", "billing_finance", "infrastructure_nas", "vpn_management", "network_management", "support_tickets", "advanced_features"]
  }
];

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seed() {
  const connection = await mysql.createConnection(DATABASE_URL);

  try {
    console.log('🌱 Starting permission plans seed...\n');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await connection.query('DELETE FROM user_permission_overrides');
    await connection.query('DELETE FROM permission_plan_groups');
    await connection.query('DELETE FROM permission_plans');
    await connection.query('DELETE FROM permission_groups');
    console.log('✅ Cleared existing data\n');

    // Insert permission groups
    console.log('📦 Inserting permission groups...');
    const groupIdMap = new Map();
    
    for (const group of permissionGroups) {
      const [result] = await connection.query(
        `INSERT INTO permission_groups (name, nameAr, description, descriptionAr, menuItems, applicableRoles) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          group.name,
          group.nameAr,
          group.description,
          group.descriptionAr,
          JSON.stringify(group.menuItems),
          JSON.stringify(group.applicableRoles)
        ]
      );
      groupIdMap.set(group.name, result.insertId);
      console.log(`  ✅ ${group.nameAr} (${group.name})`);
    }
    console.log(`\n✅ Inserted ${permissionGroups.length} permission groups\n`);

    // Insert permission plans
    console.log('📋 Inserting permission plans...');
    
    for (const plan of permissionPlans) {
      // Insert plan
      const [planResult] = await connection.query(
        `INSERT INTO permission_plans (name, nameAr, description, descriptionAr, role, isDefault, isActive) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.name,
          plan.nameAr,
          plan.description,
          plan.descriptionAr,
          plan.role,
          plan.isDefault,
          plan.isActive
        ]
      );
      
      const planId = planResult.insertId;
      
      // Insert plan-group associations
      for (const groupName of plan.groups) {
        const groupId = groupIdMap.get(groupName);
        if (groupId) {
          await connection.query(
            `INSERT INTO permission_plan_groups (planId, groupId) VALUES (?, ?)`,
            [planId, groupId]
          );
        }
      }
      
      console.log(`  ✅ ${plan.nameAr} (${plan.name}) - ${plan.groups.length} groups`);
    }
    
    console.log(`\n✅ Inserted ${permissionPlans.length} permission plans\n`);

    // Summary
    console.log('📊 Summary:');
    console.log(`  - Permission Groups: ${permissionGroups.length}`);
    console.log(`  - Permission Plans: ${permissionPlans.length}`);
    console.log(`  - Default Client Plan: Basic Client`);
    console.log(`  - Default Reseller Plan: Reseller Basic`);
    console.log('\n✅ Seed completed successfully!');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run seed
seed().catch(console.error);
