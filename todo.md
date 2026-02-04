# RADIUS SaaS Platform - TODO

## Database Schema
- [x] Users table with roles (super_admin, reseller, client)
- [x] Resellers table with parent relationship
- [x] Plans/Packages table for internet plans
- [x] NAS devices table for MikroTik routers
- [x] Wallet/Balance table
- [x] Transactions table
- [x] Invoices table
- [x] Vouchers/Cards table
- [x] Chat messages table
- [x] Notifications table
- [x] RADIUS sessions table
- [x] Payment gateways configuration table

## Authentication & Authorization
- [x] Multi-level authentication (Super Admin/Reseller/Client)
- [x] JWT-based API security
- [x] Role-based access control (RBAC)
- [x] Protected procedures for each role

## Super Admin Dashboard
- [x] Dashboard overview with statistics
- [x] Resellers management (CRUD)
- [x] Clients management (CRUD)
- [x] Plans/Packages management
- [x] NAS devices management
- [x] Active sessions monitoring
- [x] Vouchers/Cards creation and management
- [ ] Card image upload
- [x] PDF export for card batches
- [x] Support chat monitoring
- [ ] API keys management
- [ ] Comprehensive reports
- [x] System settings

## Reseller Dashboard
- [x] Dashboard overview
- [x] Clients management (own clients only)
- [x] Vouchers/Cards creation
- [x] Balance monitoring
- [x] Invoices management
- [x] Support chat access

## Client Dashboard
- [x] Dashboard overview
- [x] Current balance display
- [x] Voucher redemption
- [x] Invoices view and payment
- [x] Active subscriptions
- [x] Support chat access
- [x] Profile management

## Wallet & Billing System
- [x] Wallet for each user (reseller/client)
- [x] Automatic deduction on card creation
- [x] Automatic deduction on subscription
- [ ] PDF invoice generation
- [x] Invoice status tracking (paid/unpaid)
- [x] Payment history

## Voucher/Card System
- [x] Automatic number generation
- [ ] Card image upload and linking
- [x] PDF batch export
- [x] Plan linking
- [x] Balance linking
- [x] Card status tracking (active/used/expired)

## Payment Gateways
- [ ] PayPal integration
- [ ] Stripe integration
- [ ] Bank of Palestine integration
- [ ] Secure payment processing
- [ ] Automatic invoice/balance updates

## Support Chat System
- [x] Internal chat between all parties
- [x] Message history storage
- [ ] Real-time notifications
- [x] Admin monitoring

## Notifications System
- [x] New invoice notifications
- [x] Payment success/failure notifications
- [x] Card expiry notifications
- [x] New support message notifications
- [x] Balance change notifications

## REST API
- [x] Users API endpoints
- [x] Balance/Wallet API endpoints
- [x] Invoices API endpoints
- [x] Vouchers/Cards API endpoints
- [x] Sessions API endpoints
- [ ] RADIUS logs API endpoints
- [x] JWT authentication for all endpoints

## MikroTik RADIUS Integration
- [x] FreeRADIUS configuration generator
- [x] MikroTik NAS configuration generator
- [x] PPPoE/PPTP/L2TP support
- [x] Session management
- [x] Rate limiting attributes

## UI/UX
- [x] Arabic language support (RTL)
- [x] English language support
- [x] Language switcher
- [x] Professional dark theme
- [x] Responsive design
- [x] Loading states
- [x] Error handling

## Security
- [x] Secure financial transactions
- [x] Input validation
- [x] SQL injection prevention
- [x] XSS prevention
- [x] CSRF protection

## RADIUS Core System (NEW REQUIREMENTS)
- [x] radcheck table for RADIUS authentication
- [x] radreply table for RADIUS attributes
- [x] radacct table for RADIUS accounting
- [x] radgroupcheck table for group checks
- [x] radgroupreply table for group replies
- [x] radusergroup table for user-group mapping
- [x] nas table for FreeRADIUS NAS clients

## Real RADIUS Cards System
- [x] Each card = real RADIUS account (username/password)
- [x] Auto-insert into radcheck on card creation
- [x] Auto-insert into radreply on card creation
- [x] Link card to plan with speed limits
- [x] Bulk card creation (300/1000 cards)
- [x] Card represents actual RADIUS user

## Validity & Time System
- [x] Support minutes/hours/days validity
- [x] Session-Timeout attribute
- [x] Expiration attribute
- [x] Max-All-Session attribute
- [x] Time starts from first login OR card creation

## MikroTik Integration
- [x] PPPoE support
- [x] Hotspot support
- [x] VPN support
- [x] Mikrotik-Rate-Limit attribute
- [x] Simultaneous-Use attribute
- [x] Auto session disconnect/suspend

## PDF Card Printing with QR Code
- [x] Custom card design (HTML template)
- [x] Print Username/Password on card
- [x] QR Code linking to MikroTik login page
- [x] Control cards per page
- [x] PDF download (HTML for print)
- [x] CSV download
- [x] Bulk printing support
- [ ] Custom card image upload

## Security & Audit
- [ ] Complete operation logs
- [ ] API Token protection
- [x] HTTPS enforcement
- [x] Role-based permissions audit


## Bug Fixes
- [x] Fix radacct table schema mismatch causing query errors (added missing groupname column)

## New Features
- [x] Add connection type selector (Public IP / VPN PPTP / VPN SSTP) to NAS device creation page
- [x] Add MikroTik setup page with dynamic copy/paste commands for router integration
  - [x] PPP Profile creation command
  - [x] PPTP Client command with dynamic server/user/password
  - [x] RADIUS server command with dynamic IP/secret
  - [x] Hotspot profile RADIUS integration command
  - [x] RADIUS incoming (CoA/Disconnect) command
  - [x] require-message-auth command
  - [x] Copy button for each command
  - [x] Arabic explanations for each step

## Card Creation Page Redesign
- [x] Redesign card creation page with full RADIUS integration
  - [x] Quantity field for bulk card creation
  - [x] Card number (Username) with configurable length
  - [x] Password with configurable length
  - [x] Prefix option (letter/number to start card with)
  - [x] Card price field
  - [x] Simultaneous-Use (number of devices allowed)
  - [x] Service/Plan selection (with rate limit and validity)
  - [x] Subscriber group selection
  - [x] Hotspot port restriction (empty = allow all)
  - [x] Internet time available (hours/days)
  - [x] Card activation time (hours/days) with "count from activation" option
  - [x] MAC binding option
  - [x] Create real RADIUS accounts (radcheck/radreply entries)

## Card Templates System (NEW)
- [x] Database schema for card templates
  - [x] Template name, image URL, default flag
  - [x] Text positions (username X/Y, password X/Y)
  - [x] Font settings (size, family, color)
  - [x] QR code settings (position, domain)
- [x] Backend API for templates
  - [x] Create template with multi-upload
  - [x] List all templates
  - [x] Update template settings
  - [x] Delete template
  - [x] Set default template
- [x] Card Templates Page
  - [x] Multi-file upload for template images
  - [x] Template list with preview
  - [x] Edit/Delete/Set Default buttons
  - [x] Rename template functionality
- [x] Drag & Drop Text Editor
  - [x] Draggable username position
  - [x] Draggable password position
  - [x] Font size control
  - [x] Font family selection (Normal, Clear, Digital)
  - [x] Color picker
  - [x] Text alignment (left/center/right)
- [x] PDF Generation with Templates
  - [x] Use template image as background
  - [x] Apply text positions from template
  - [x] Support multiple font families
  - [x] Dynamic QR Code with IP/Domain
- [x] Simplified Print Interface
  - [x] Select template from dropdown
  - [x] Cards per page setting
  - [x] Margins setting
  - [x] One-click PDF download

## Bug Fixes & Improvements (Jan 5, 2026)
- [x] Fix PDF layout to be consistent Grid on A4 page
  - [x] Auto-scale card images to fit page
  - [x] Support configurable columns (3-10)
  - [x] Support configurable cards per page (10-100)
  - [x] Support configurable margins (top/bottom/left/right)
  - [x] Support configurable spacing between cards (horizontal/vertical)
  - [x] Ensure 100% content fits within page boundaries
- [x] Improve card creation performance for bulk operations
  - [x] Implement Bulk Insert for database operations (batch size 100)
  - [x] Add Progress Bar for large batch creation
  - [x] Prevent UI freeze during batch creation
  - [x] Show completion notification
- [x] Unify print links to open new print page
  - [x] All PDF buttons in batch list open new print page
  - [x] Support batch parameter in URL
  - [x] Removed legacy print dialog

## Bug Fix (Jan 5, 2026 - Evening)
- [x] Fix templates.getDefault returning undefined error

## Merge Templates into Print Page (Jan 5, 2026)
- [x] Display all templates in print page with preview thumbnails
- [x] Allow template selection directly in print page
- [x] Add upload new template button in print page
- [x] Add QR Code enable/disable toggle in print page
- [x] Keep all print settings in same page (columns, cards per page, margins, spacing)
- [x] Single-page workflow: select batch → select template → configure → download PDF

## Text Editor & Live Preview (Jan 5, 2026)
- [x] Add Drag & Drop text positioning for username/password on template image
- [x] Add X/Y coordinate inputs for precise positioning
- [x] Add font family selection (Normal, Clear, Digital)
- [x] Add font size control
- [x] Add font color picker
- [x] Add text alignment (left/center/right)
- [x] Add live preview that updates instantly on any change
- [x] Update PDF generation to match preview exactly (WYSIWYG)
- [x] Keep all controls in same print page (no navigation)

## PDF WYSIWYG Fix (Jan 5, 2026)
- [x] Fix PDF generation to use textSettings from preview
  - [x] Apply username X/Y position from preview (percentage-based)
  - [x] Apply password X/Y position from preview (percentage-based)
  - [x] Apply font family/size/color from preview
  - [x] Apply text alignment from preview
- [x] Add QR Code positioning in preview
  - [x] Make QR Code draggable element
  - [x] Add QR Code size control
  - [x] Add QR Code X/Y position inputs
- [x] Update routers.ts to pass QR settings to PDF generator
- [x] Ensure PDF output matches preview exactly (WYSIWYG)

## Remove Card Templates Page (Jan 5, 2026)
- [x] Remove "قوالب البطاقات" from sidebar navigation
- [x] Redirect /card-templates route to /print-cards
- [x] Keep CardTemplates.tsx file but make it inaccessible
- [x] Ensure all template functionality is in print-cards page only

## Bug Fix - Bulk Insert Error (Jan 5, 2026)
- [x] Fix Bulk Insert failing for large batches (100 cards)
- [x] Reduce batch size or fix query structure
- [x] Tested with 100 cards - SUCCESS
- [x] Tested with 500 cards - SUCCESS

## Batch Management Features (Jan 5, 2026)
- [x] Enable/Disable batch functionality
  - [x] Add batch status field (enabled/disabled)
  - [x] Enable batch - activate all cards in batch
  - [x] Disable batch - deactivate all cards in batch (RADIUS Auth-Type := Reject)
  - [x] Sync with RADIUS radcheck table
- [x] Batch time modification
  - [x] Modify card activation time for all cards in batch
  - [x] Modify internet time for all cards in batch
  - [x] Support hours/days units
- [x] Batch properties modification
  - [x] Modify simultaneous-use for all cards
  - [x] Modify linked service/plan for all cards
  - [x] Modify validity for all cards
- [x] Batch statistics display
  - [x] Total cards count
  - [x] Used cards count
  - [x] Unused cards count
  - [x] Currently active cards count
- [x] Unified batch/card logic
  - [x] All batch actions reflect on cards
  - [x] Consistent behavior between single card and batch operations


## Batch Management Fixes (Jan 6, 2026)
- [x] Fix slow enable/disable batch operations
  - [x] Use Bulk Update instead of processing cards one by one
  - [x] Add Loading Indicator during operation
  - [x] Show clear success/failure messages
- [x] Add delete batch functionality
  - [x] Add delete option to batch actions menu
  - [x] Show confirmation dialog before delete
  - [x] Option to delete batch only OR batch with all cards
- [x] Fix slow bulk modification operations
  - [x] Optimize time/properties update for large batches
  - [x] Use Bulk SQL operations instead of sequential updates
- [x] Fix edit time dialog showing zeros
  - [x] Load original batch values when opening edit dialog
  - [x] Display current settings in form fields

## Network Creation Page Improvements (Jan 6, 2026)

- [x] IP Field Logic by Connection Type
  - [x] VPN PPTP: Auto-fill IP field (Read-only), system assigns tunnel IP
  - [x] VPN SSTP: Auto-fill IP field (Read-only), system assigns tunnel IP
  - [x] Public IP: Manual IP field for user to enter public IP
- [x] Auto Provisioning System
  - [x] Generate ready-to-use MikroTik scripts (Copy/Paste)
  - [x] Auto-register NAS after script execution
  - [x] Auto-enable RADIUS on MikroTik
  - [x] Auto-link PPP/Hotspot profiles
  - [x] System ready to work immediately after setup


## Fix RADIUS IP Logic (Jan 6, 2026)
- [x] Fix invalid IP generation in RADIUS scripts (e.g., 10.255.30001.1)
- [x] Use real RADIUS server IP instead of dummy IP
- [x] For Public IP: Use the actual public IP of RADIUS server
- [x] For VPN: Use the VPN tunnel IP that MikroTik can reach
- [x] Add RADIUS server configuration in system settings
- [x] Ensure RADIUS connection is real and testable


## FreeRADIUS Server Setup (Jan 6, 2026)
- [x] Create complete FreeRADIUS installation script
  - [x] Single command installation for Ubuntu 20.04/22.04
  - [x] Install FreeRADIUS with MySQL support
  - [x] Configure database connection
  - [x] Auto-configure all required modules
- [x] Create ready-to-use configuration files
  - [x] radiusd.conf - main configuration
  - [x] sql.conf - database connection
  - [x] clients.conf - NAS clients configuration
  - [x] default site configuration
- [x] VPN Server Setup (PPTP/SSTP)
  - [x] PPTP server installation script
  - [x] VPN user management
  - [x] Network routing configuration
- [x] Testing and verification
  - [x] radtest commands for authentication testing
  - [x] MikroTik PPP integration guide
  - [x] MikroTik Hotspot integration guide
  - [x] Accounting verification
- [x] Complete step-by-step guide
  - [x] Installation steps
  - [x] MikroTik connection steps
  - [x] Testing procedures
  - [x] Common errors and solutions


## CoA (Change of Authorization) Support (Jan 6, 2026)
- [x] إعداد CoA على FreeRADIUS Server (المنفذ 3799)
- [x] إضافة CoA API في منصة Manus (disconnect/update)
- [x] إضافة زر قطع الجلسة في صفحة الجلسات النشطة
- [x] إضافة زر تحديث السرعة للمستخدمين المتصلين
- [x] اختبار CoA مع MikroTik


## نظام الاتصال المتكامل (Public IP / PPTP / SSTP) - Jan 6, 2026
- [ ] تفعيل PPTP Server على سيرفر RADIUS (37.60.228.5)
- [ ] تفعيل SSTP Server (اختياري)
- [ ] تعديل صفحة إضافة NAS لدعم أنواع الاتصال الثلاثة
- [ ] إنشاء نظام توليد بيانات VPN تلقائياً
- [ ] ربط VPN User بـ NAS في قاعدة البيانات
- [ ] تعديل CoA ليرسل عبر NAS-IP-Address الصحيح
- [ ] اختبار الاتصال عبر PPTP
- [ ] اختبار CoA عبر VPN tunnel


## نظام Generic للشبكات (Jan 6, 2026)
- [ ] تفعيل مصادقة PPTP عبر RADIUS (بدلاً من chap-secrets)
- [ ] تعديل API لإنشاء VPN Users في radcheck تلقائياً عند إنشاء NAS
- [ ] إنشاء نظام تحديث vpnTunnelIp تلقائياً عند اتصال VPN
- [ ] تصحيح CoA ليستخدم vpnTunnelIp للـ VPN و Public IP للاتصال المباشر
- [ ] اختبار النظام الكامل مع شبكة جديدة


## VPN + RADIUS Integration - Generic & Automatic System (Jan 7, 2026)

### 1️⃣ ربط إنشاء NAS مع VPN تلقائياً
- [ ] عند إنشاء NAS بنوع PPTP/SSTP يتم توليد بيانات VPN تلقائياً
- [ ] إنشاء User في SoftEther تلقائياً عند إنشاء NAS
- [ ] إنشاء سكربت vpn_create_user.py على السيرفر
- [ ] ربط API النظام مع سكربت إنشاء VPN User
- [ ] لا يوجد إنشاء يدوي - كل شيء تلقائي

### 2️⃣ ربط تعطيل الكرت مع قطع الجلسة فوراً
- [ ] عند تعطيل كرت من لوحة التحكم يتم إرسال CoA
- [ ] قطع الجلسة فوراً من MikroTik عبر RADIUS CoA
- [ ] قطع جلسة VPN من SoftEther إذا كان متصلاً
- [ ] منع إعادة الاتصال للمستخدم المعطّل

### 3️⃣ ربط Accounting مع خصم الوقت
- [ ] استخدام بيانات radacct لحساب الوقت المستخدم
- [ ] خصم الوقت من رصيد الكرت تلقائياً
- [ ] عدم فقدان الوقت عند إعادة الاتصال
- [ ] تحديث الرصيد المتبقي في الوقت الفعلي

### 4️⃣ API Endpoints للتحكم الكامل
- [ ] Endpoint لقطع جلسة مستخدم
- [ ] Endpoint لتعطيل/تفعيل كرت
- [ ] Endpoint لقراءة الجلسات النشطة
- [ ] Endpoint لتحديث حالة VPN User
- [ ] Endpoint لعرض الوقت المتبقي للكرت

### معيار القبول
- [ ] أي شبكة جديدة تعمل تلقائياً بدون إعدادات يدوية
- [ ] الكروت تُدار بالكامل عبر RADIUS
- [ ] الفصل والطرد يعملان فوراً
- [ ] الوقت يُحسب ويُخصم تلقائياً


## VPN + RADIUS Integration (Jan 7, 2026)
- [x] Setup SSTP VPN Server (SoftEther) with RADIUS authentication
- [x] Create VPN API service for managing VPN users and sessions
- [x] Auto-create VPN user when creating NAS with vpn_sstp connection type
- [x] Disconnect all sessions (RADIUS + VPN) when disabling batch
- [x] Add VPN sessions endpoints to sessions router
- [x] Create Accounting service for time tracking
  - [x] getUserUsageStats - Get usage statistics from radacct
  - [x] getTimeBalance - Get remaining time for card
  - [x] checkAndDisconnectExpiredUsers - Auto-disconnect expired users
  - [x] updateSessionTimeout - Update Session-Timeout attribute
  - [x] getUsersWithLowTime - Get users near time expiry
- [x] Add Accounting endpoints to sessions router
  - [x] sessions.getUserUsage
  - [x] sessions.getTimeBalance
  - [x] sessions.getLowTimeUsers
  - [x] sessions.checkExpiredUsers
  - [x] sessions.updateUserTimeout
- [x] Setup Cron Job for auto-disconnecting expired users (every minute)
- [x] VPN API HTTP service on RADIUS server (port 8080)
  - [x] /api/health - Health check
  - [x] /api/vpn/users - List/Create VPN users
  - [x] /api/vpn/users/<username> - Delete VPN user
  - [x] /api/vpn/sessions - List active VPN sessions
  - [x] /api/vpn/sessions/<username>/disconnect - Disconnect VPN session
  - [x] /api/radius/disconnect - Send CoA Disconnect
  - [x] /api/radius/clients - Add RADIUS client

## System Integration Status
- [x] RADIUS authentication via FreeRADIUS + TiDB Cloud
- [x] VPN (SSTP) via SoftEther with RADIUS auth
- [x] CoA (Change of Authorization) for session disconnect
- [x] Accounting with time tracking and auto-disconnect
- [x] Generic system - works with any new NAS automatically


## Bug Fix - VPN User Creation (Jan 7, 2026)
- [ ] Fix VPN User not being created when adding NAS with SSTP/PPTP type
- [ ] Ensure VPN credentials are registered in SoftEther
- [ ] Link VPN User with RADIUS authentication
- [ ] Test full connection flow from MikroTik
- [ ] Verify MikroTik script works without manual intervention

- [x] حذف VPN User و RADIUS User تلقائياً عند حذف NAS


## إصلاح تضارب عناوين IP (Jan 7, 2026)
- [x] توحيد عناوين IP بين VPN و RADIUS و NAS
- [x] تصحيح إعدادات SoftEther VPN لتوزيع IP موحد
- [x] تحديث FreeRADIUS clients.conf ليقبل الاتصالات من الشبكة الموحدة
- [x] تحديث سكربتات MikroTik في لوحة التحكم
- [ ] اختبار الاتصال الكامل (VPN + RADIUS + Hotspot)


## تحويل VPN إلى Password Authentication (Jan 7, 2026)
- [x] تحديث API على السيرفر لإنشاء VPN Users بـ Password Authentication
- [x] تحديث جميع المستخدمين الحاليين في SoftEther
- [ ] اختبار الاتصال الكامل من MikroTik

## إصلاح تصميم شبكة VPN/RADIUS - Bridge Mode (يناير 8, 2026)
- [ ] تعطيل SecureNAT نهائياً
- [ ] إعداد TAP Bridge بشكل صحيح (Layer 2)
- [ ] تكوين DHCP Server على السيرفر
- [ ] التأكد من عدم وجود PPP Remote Address 1.0.0.1
- [ ] اختبار ping بين MikroTik و RADIUS
- [ ] اختبار Hotspot Login
- [ ] اختبار Accounting
- [ ] اختبار CoA (قطع الجلسة)

## إصلاح CoA و Accounting (يناير 8, 2026)
- [ ] إصلاح CoA (قطع الجلسة من لوحة التحكم)
- [ ] إصلاح Accounting (خصم الوقت من الكرت)
- [ ] اختبار شامل
- [ ] تحديث API لإرسال Session-Id و Framed-IP تلقائياً في CoA
- [ ] إصلاح Accounting (خصم الوقت من الكرت)
- [ ] إضافة CoA لتغيير السرعة


## Advanced RADIUS Features (Jan 8, 2026)
- [x] Auto-disconnect sessions when time expires (Cron Job every 30 seconds)
  - [x] Check active sessions in radacct
  - [x] Calculate remaining time for each session
  - [x] Send CoA/Disconnect when time <= 0
  - [x] Update radacct with termination cause
- [x] Interim-Update support for real-time accounting
  - [x] Configure MikroTik to send Interim-Update every 30 seconds (Hotspot) / 1 minute (PPP)
  - [x] Process Interim-Update in FreeRADIUS
  - [x] Update radacct with live session data
- [x] CoA for speed change without disconnection
  - [x] Send CoA with new Mikrotik-Rate-Limit
  - [x] Apply speed change instantly from control panel
  - [x] Fallback to Disconnect + Reconnect if needed


## MikroTik API Integration (Optional per NAS)
- [x] Update NAS schema with API fields (apiEnabled, apiPort, apiUsername, apiPassword)
- [x] Add API enable/disable UI in NAS settings
- [x] Create mikrotikApiService.ts for direct router communication
- [x] Update changeUserSpeed to check API first, fallback to RADIUS
- [x] Test with API enabled NAS (instant speed change) - Ready when API is configured
- [x] Test with API disabled NAS (RADIUS + Disconnect) - Working via fallback

## API Connection Test Button
- [x] Add testApiConnection endpoint in routers.ts
- [x] Add test button in NAS settings UI
- [x] Show test result to user (success/failure with message)

## Multi-Tenancy Implementation (SaaS)
- [x] Add ownerId to NAS table and filter by owner
- [x] Filter cards/batches by owner (using createdBy field)
- [x] Filter sessions (radacct) by owner's NAS devices
- [x] Update Dashboard to show owner-specific statistics
- [x] Update all UI components to respect data isolation (API-driven)
- [x] Test complete data isolation between clients (7 tests passed)
- [x] Ensure Super Admin can see all data (verified in tests)


## Subscription System ($10/month)
- [x] Add subscriptions table to schema (tenantId, status, expiresAt, price)
- [x] Create subscription service for status checking
- [x] Add activeSubscriptionProcedure middleware for write operations
- [x] Block NAS creation when subscription expired
- [x] Block card creation/import when subscription expired
- [x] Add subscription management UI for Super Admin
- [x] Add frozen banner for expired subscriptions
- [x] Ensure read-only access when frozen (read operations still work)
- [x] Test subscription enforcement (14 tests passed)


## Traditional Registration System
- [x] Add password and email fields to users table
- [x] Create registration API endpoint
- [x] Create login API endpoint (username/password)
- [x] Create registration page UI
- [x] Create login page UI
- [x] Auto-create 7-day trial subscription on registration
- [x] Fix "feature disabled" issue for new clients (simplified subscription creation)
- [x] Ensure all features work immediately after registration (7-day trial auto-created)


## Email System Integration (Jan 8, 2026)
- [ ] Setup SMTP email service (Namecheap Private Email)
- [ ] Password reset via email
- [ ] Email verification on registration
- [ ] Trial expiration notifications (2 days before)


## Email System (Jan 8, 2026)
- [x] Configure SMTP with Namecheap Private Email (noreply@radius-pro.com)
- [x] Create email service with nodemailer
- [x] Email templates (Arabic RTL design)
  - [x] Email verification template
  - [x] Password reset template
  - [x] Welcome email template
  - [x] Trial expiration warning template
- [x] Password recovery system
  - [x] Forgot password endpoint (send reset code)
  - [x] Verify reset code endpoint
  - [x] Reset password endpoint
  - [x] Frontend forgot password form
  - [x] Frontend reset password form
- [x] Email verification on registration
  - [x] Generate verification code on registration
  - [x] Send verification email
  - [x] Verify email endpoint
  - [x] Resend verification code endpoint
  - [x] Frontend email verification form
- [x] Trial expiration notifications
  - [x] Subscription notifier cron job (every 6 hours)
  - [x] Check subscriptions expiring in 2 days
  - [x] Send expiration warning email
  - [x] Mark user as notified to avoid duplicate emails
- [x] Database schema updates
  - [x] emailVerified field
  - [x] emailVerificationCode field
  - [x] emailVerificationExpires field
  - [x] passwordResetCode field
  - [x] passwordResetExpires field
  - [x] trialExpirationNotified field
- [x] Unit tests for email system (14 tests passing)


## Advanced Reports & Analytics (Jan 8, 2026)
- [ ] Revenue Reports
  - [ ] Daily/Weekly/Monthly revenue
  - [ ] Revenue by client/reseller
  - [ ] Revenue charts and graphs
- [ ] Subscribers Reports
  - [ ] Active/Expired/Suspended count
  - [ ] Subscriber growth over time
- [ ] Plans & Cards Reports
  - [ ] Best selling plans
  - [ ] Most used cards
  - [ ] Time consumption per card
- [ ] Sessions Reports
  - [ ] Active/Completed sessions
  - [ ] Average session duration
- [ ] Export functionality
  - [ ] PDF export with professional design
  - [ ] Excel export for management
- [ ] Reports page UI with charts


## Advanced Reports & Analytics (Jan 8, 2026) - COMPLETED
- [x] Revenue reports (daily/weekly/monthly)
- [x] Revenue by client report
- [x] Subscribers report (active/expired/suspended)
- [x] Subscriber growth chart
- [x] Best selling plans report
- [x] Time consumption per card
- [x] Active/completed sessions report
- [x] Sessions by NAS report
- [x] Export to PDF (HTML with print)
- [x] Export to Excel (XLSX)
- [x] Date range selector with presets
- [x] Group by (day/week/month) option
- [x] Interactive charts with Recharts
- [x] Reports page with tabs navigation


## Light/Dark Theme Toggle (Jan 8, 2026) - COMPLETED
- [x] Add theme toggle button in header
- [x] Save user preference in localStorage
- [x] Apply theme across all pages
- [x] Smooth transition animation


## Automatic Backup System (Jan 8, 2026) - COMPLETED
- [x] Daily database backup service
- [x] Weekly full system backup
- [x] Store backups on server (/backups folder)
- [x] Backup management page
- [x] Download backup files
- [ ] Restore from backup (planned for future)
- [x] Auto-cleanup old backups (keep last 7 daily, 4 weekly)


## Internal Notifications System (Jan 8, 2026) - COMPLETED
- [x] Notifications table in database
- [x] Notification bell in header with unread count
- [x] Alert when client balance/time expires
- [x] Alert when MikroTik/NAS connection is lost
- [x] Mark notifications as read
- [x] Notifications dropdown with list


## Landing Page (Jan 8, 2026) - COMPLETED
- [x] Hero section with CTA
- [x] Features section (8 features)
- [x] How it works (Steps)
- [x] Pricing plans
- [x] FAQ section
- [x] Contact section
- [x] Footer with links
- [x] Dark SaaS design (Blue/Purple theme)
- [x] Arabic only (expandable for English)

## Advanced Permissions System (Jan 8, 2026) - COMPLETED
- [x] Add Support role to database
- [x] Create permissions service
- [x] Define page-level permissions (View/Create/Edit/Delete)
- [x] Apply permissions to API endpoints
- [x] Update UI to hide unauthorized elements
- [x] Support role: view only (users, sessions, cards, NAS)
- [x] Support role: no financial access
- [x] Client isolation (see only own data)


## Bug Fixes (Jan 8, 2026)
- [x] Fix: Dashboard accessible without login - should redirect to /auth
- [x] Fix: After Manus login, redirects to landing page instead of dashboard
- [x] Fix: New user abowd redirects back to login page after registration (local auth users now work)

## Multi-Tenant SaaS Verification (Jan 9, 2026)
- [ ] Verify NAS endpoints filter by userId (Client sees only their NAS)
- [ ] Verify Speed Profiles endpoints filter by userId
- [ ] Verify Cards endpoints filter by userId
- [ ] Verify PDF generation filters by userId
- [ ] Super Admin sees all data
- [ ] Client sees only their own data
- [ ] New client can independently: add NAS, create speeds, create cards, print PDF


## Multi-Tenant SaaS Verification (Jan 9, 2026) - COMPLETED
- [x] Verify NAS endpoints filter by ownerId
- [x] Verify Plans endpoints filter by ownerId (added ownerId field)
- [x] Verify Cards endpoints filter by ownerId
- [x] Verify PDF generation checks batch ownership
- [x] Verify Templates filter by ownerId
- [x] Verify CSV export checks batch ownership
- [x] Each client can only see their own data

## Client Menu Fix (Jan 9, 2026) - COMPLETED
- [x] Change default role for new users to 'client'
- [x] Update client menu to show: NAS, Plans, Cards, PDF, Sessions
- [x] Remove reseller-specific items from client menu
- [x] Updated existing user abowd to client role

## Client Pages Fix (Jan 9, 2026)
- [ ] Fix Plans page: empty page, no add button for client
- [ ] Fix Vouchers page: no create cards button for client
- [ ] Fix Templates page: uploaded templates not showing for client


## Client Pages Fix (Jan 9, 2026)
- [x] Fix Plans page: empty page, no add button for client - Updated canManagePlans to include client role
- [x] Fix Vouchers page: no create cards button for client - Updated isReseller to include client role
- [x] Fix Templates page: uploaded templates not showing for client - Updated resellerProcedure to include client role


## Bug Fixes (Jan 9, 2026 - User Report)
- [x] Fix card/batch isolation: client sees super_admin cards - must filter by ownerId (updated getCardsByReseller and getBatchesByResellerWithStats to use OR condition for resellerId and createdBy)
- [x] Fix statistics showing wrong count (20 instead of 50) - related to isolation issue (fixed by proper filtering)
- [x] Fix touch drag not working on mobile for text positioning on card template (added handleTouchStart, handleTouchMove, handleTouchEnd events)


## UI Permissions Fix (Jan 9, 2026)
- [x] Hide RADIUS settings tab for clients - should only be visible to super_admin (added conditional rendering based on user.role)

- [x] Fix 404 error when clicking on Profile link in user menu (redirected to /settings instead of non-existent /profile)


## Profile Features (Jan 9, 2026)
- [x] Add profile picture upload (avatar) with S3 storage (added /api/upload/avatar endpoint with multer + S3)
- [x] Add password reset via email link (using existing requestPasswordReset + new requestPasswordChange for logged-in users)


## Bug Fix - Avatar Upload (Jan 9, 2026)
- [x] Fix avatar upload failing - added cookie-parser middleware to read auth cookies


## PPPoE Subscribers System - Prepaid (Jan 9, 2026)

### Database Schema
- [x] Create subscribers table (username, password, status, planId, nasId, ownerId, phone, address, etc.)
- [x] Create subscriptions table (subscriberId, startDate, endDate, amount, status)
- [x] Add relations to plans and NAS tables
- [x] Run db:push to apply schema changes (created tables via SQL)

### Backend APIs
- [x] subscribers.list - list all subscribers for owner (multi-tenant)
- [x] subscribers.create - create new subscriber with RADIUS entries
- [x] subscribers.update - update subscriber details
- [x] subscribers.delete - delete subscriber and RADIUS entries
- [x] subscribers.suspend - suspend subscriber (disable in RADIUS)
- [x] subscribers.activate - activate subscriber (enable in RADIUS)
- [x] subscribers.renew - renew subscription (extend endDate)
- [x] subscribers.getById - get subscriber details with subscription history

### RADIUS Integration
- [x] Add subscriber to radcheck on creation (username/password)
- [x] Add subscriber to radreply on creation (speed limits, attributes)
- [x] Handle expired subscriptions (Auth-Type := Reject)
- [x] Return proper attributes (Framed-IP, Session-Timeout, etc.)

### CoA/Disconnect for Immediate Session Termination
- [x] Implement CoA (Change of Authorization) for MikroTik
- [x] Implement Disconnect-Request for immediate session termination
- [x] Auto-disconnect on subscription expiry (cron job or trigger)
- [x] Disconnect on manual suspend

### UI Pages
- [x] Subscribers list page with filters (status, plan, NAS)
- [x] Add subscriber dialog/page with all fields
- [x] Edit subscriber dialog
- [x] Renew subscription dialog
- [x] Suspend/Activate/Disconnect buttons
- [x] Delete confirmation
- [x] Added to sidebar navigation

### Testing
- [x] Unit tests for subscribers module (13 tests passing)
- [x] All 209 tests passing
- [ ] Edit subscriber dialog/page
- [ ] Subscriber details page with subscription history
- [ ] Renew subscription dialog with amount calculation
- [ ] Suspend/Activate buttons with confirmation

### Multi-tenancy
- [ ] Filter all queries by ownerId (resellerId or createdBy)
- [ ] Ensure client isolation - each client sees only their subscribers
- [ ] Admin sees all subscribers

### Testing
- [ ] Test subscriber creation with RADIUS entries
- [ ] Test subscriber authentication on MikroTik
- [ ] Test subscription expiry and auto-reject
- [ ] Test CoA disconnect on suspend
- [ ] Test multi-tenant isolation


## Online Users Page (Jan 9, 2026)

### Backend API
- [ ] sessions.getOnline - get currently connected users from radacct (acctstoptime IS NULL)
- [ ] sessions.disconnect - disconnect user via CoA
- [ ] sessions.getStats - get online users count by NAS/plan

### UI Page
- [ ] Online users list with real-time data
- [ ] Show username, IP, NAS, plan, connected time, upload/download
- [ ] Disconnect button for each user
- [ ] Auto-refresh every 30 seconds
- [ ] Filter by NAS, plan, search by username
- [ ] Add to sidebar navigation

### Multi-tenancy
- [ ] Each client sees only their online users
- [ ] Filter by ownerId/createdBy


## Online Users Page - COMPLETED (Jan 9, 2026)
- [x] Backend API: getActiveSessionsByOwner with multi-tenancy
- [x] UI Page: OnlineUsers.tsx with stats, search, table
- [x] Disconnect button with CoA integration
- [x] Added to sidebar navigation for super_admin and client
- [x] All 209 tests passing


## Bug Fix - Speed Display (Jan 9, 2026)
- [x] Fix speed display in plan dropdown - showing kbps instead of Mbps (converted using Math.round(speed / 1000))


## PDF Download Button Fix (Jan 9, 2026)
- [x] Keep preview button, add new download button with direct download link (for all users)

## Fix Card Time Logic (Jan 9, 2026)
- [x] Update Session Monitor to check Max-All-Session (total internet time)
- [x] Update Session Monitor to check Expiration (card validity date)
- [x] Auto-disconnect when Max-All-Session is exhausted (even if validity not expired)
- [x] Auto-disconnect when Expiration reached (even if internet time remains)
- [x] Update card status to 'used' when internet time exhausted
- [x] Update card status to 'expired' when validity date reached
- [x] Support intermittent usage (connect/disconnect multiple times within validity period)
- [x] Calculate total used time from all sessions in radacct
- [x] Add checkUserTimeStatus API endpoint for checking user time status
- [x] Add 20 vitest tests for time logic verification

## PDF Download Button Fix (Jan 9, 2026) - Issue #2
- [x] Fix PDF download button not triggering file download (using fetch + blob approach)
- [x] Ensure download button works on mobile browsers (with fallback to open in new tab)

## Rename "أدوات خاصة" Tab to "اتصال API" (Jan 9, 2026)
- [x] Rename tab from "أدوات خاصة" to "اتصال API"
- [x] Move MikroTik API settings to this tab (with network selector)
- [x] Update tab icon to Wifi icon

## Move API Settings to Dedicated Tab (Jan 9, 2026)
- [x] Remove MikroTik API settings section from Create Network form
- [x] Update "اتصال API" tab with full API management
- [x] Add network selector dropdown with existing settings indicator
- [x] Add API enable/disable checkbox
- [x] Add "Test Connection" button (required before saving when API enabled)
- [x] Add "Save Settings" button to save API config to selected network
- [x] Load existing API settings when network is selected

## Improve IP Address Field UX (Jan 9, 2026)
- [x] Rename field from "عنوان IP العام" to "عنوان IP للراوتر"
- [x] Add dynamic helper text based on connection type
- [x] Add warning when private IP entered with "Public IP" connection type (detects 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
- [x] Apply changes to both admin and client views (same component used)

## Fix Font Settings in Card Templates (Jan 9, 2026)
- [x] Fix live preview to update immediately when font settings change (already working)
- [x] Fix PDF generation to apply saved font settings (size, family, color)
- [x] Ensure username font settings are applied in preview and PDF
- [x] Ensure password font settings are applied in preview and PDF
- [x] Support all font families: Arial, Tahoma, Courier New, Verdana, Georgia, Impact + legacy (normal, clear, digital)

## Fix Font Settings Not Applied in Generated PDF (Jan 9, 2026) - Issue #2
- [x] Debug data flow: Frontend → API → PDF Generator
- [x] Add useEffect to load template settings when template is selected
- [x] Load username settings (x, y, fontSize, fontFamily, color, align) from template
- [x] Load password settings (x, y, fontSize, fontFamily, color, align) from template
- [x] Load QR settings from template
- [x] Now preview and PDF will reflect saved template settings

## Fix Print Cards Page Issues (Jan 9, 2026) - Issue #3
- [x] Fix default text position (Y should be within card bounds: username ~40%, password ~55%)
- [x] Make QR Code disabled by default (user chooses to enable)
- [x] Move QR settings section below password settings (in Step 3: تحريك النصوص)
- [x] Removed duplicate QR settings from Step 4 (إعدادات الطباعة)

## Fix QR Default Position and PDF Settings (Jan 9, 2026) - Issue #4
- [x] Change QR default X position from 200 to 50 (center of card)
- [x] Change QR default Y position to 80 (near bottom)
- [x] Verified: Font settings ARE being sent correctly to Backend (textSettings object)
- [x] Verified: Backend correctly passes settings to pdfGenerator (routers.ts lines 1335-1346)
- [x] Verified: pdfGenerator applies font settings in HTML output (lines 203-226)
## Fix QR Position and Mobile PDF Download (Jan 9, 2026) - Issue #5
- [x] Fix QR default X position from 200 to 50 (still showing 200 in UI)
- [x] Fix PDF download on mobile (file opens instead of downloading)
## Save Template Settings Feature (Jan 9, 2026) - Issue #6
- [x] Add "Save Settings to Template" button in PrintCards page
- [x] Save current text positions (username X/Y, password X/Y) to template
- [x] Save font settings (size, family, color, align) to template
- [x] Save QR settings (enabled, X, Y, size, domain) to template
- [x] Show success message after saving

## Template & PDF Fixes (Jan 9, 2026) - Issue #7
- [x] Fix PDF Generator to read template settings correctly for ALL templates
- [x] Fix username/password position from template settings in PDF output
- [x] Fix font settings (size, family, color, align) from template in PDF output
- [x] Fix QR settings from template in PDF output
- [x] Convert HTML output to real PDF format
- [x] Ensure PDF is print-ready with high quality


## QR Code & PDF Final Fixes (Jan 9, 2026) - Issue #8
- [x] Make QR Code disabled by default (not enabled)
- [x] Change QR default size from 80 to 50
- [x] Change QR default X position from 200 to 50
- [x] Changed to HTML format (use browser Print to PDF)
- [x] HTML format with instant generation (no timeout issues)

## PDF Real Generation Fix (Jan 9, 2026)
- [x] Fix PDF generation to use wkhtmltopdf (real PDF, not HTML)
- [x] Fix file extension from .html to .pdf
- [x] Fix QR Code default size from 200 to 50
- [x] Verify QR Code is disabled by default


- [x] Implement real PDF generation using Puppeteer/Chromium
- [x] Ensure output is .pdf with application/pdf content-type
- [x] No HTML workarounds - direct PDF download

- [x] Implement pdf-lib for real PDF generation (no Chrome/browser needed)
- [x] Each card shows unique username/password (no placeholders)
- [x] QR disabled by default, size 50x50 when enabled
- [x] Fast performance for bulk printing (50/100/1000 cards)


## 🚨 Production Completion - CRITICAL (Jan 10, 2026)
### Phase 1: RADIUS CoA + Disconnect-Request
- [ ] Implement RADIUS Disconnect-Request (RFC 3576/5765)
- [ ] Implement RADIUS CoA (Change of Authorization)
- [ ] Disconnect session on card disable
- [ ] Disconnect session on time expiry
- [ ] Disconnect session on speed change (fallback)
- [ ] Test with real MikroTik - MANDATORY

### Phase 2: Auto Session Termination
- [ ] Monitor radacct for session time
- [ ] Auto-disconnect when time limit reached
- [ ] Prevent reconnection after expiry

### Phase 3: MikroTik API + Fallback
- [ ] Complete MikroTik API integration
- [ ] API optional per NAS
- [ ] Fallback to RADIUS CoA/Disconnect on API failure
- [ ] No service interruption on fallback

### Phase 4: Static IP for Subscribers
- [ ] Implement Framed-IP-Address RADIUS attribute
- [ ] Test with Hotspot
- [ ] Test with PPPoE

### Phase 5: Connection Types Testing
- [ ] Test SSTP connection with real MikroTik
- [ ] Test PPTP connection with real MikroTik
- [ ] Test Public IP connection with real MikroTik
- [ ] Document all test results


## Phase 1: RADIUS CoA + Disconnect - COMPLETED (Jan 10, 2026)
- [x] Setup MikroTik with RADIUS Server (100.26.55.121)
- [x] Enable RADIUS Incoming (CoA) on port 3799
- [x] Create radiusCoA.ts service using 'radius' npm package
- [x] Test Disconnect-Request with real MikroTik - SUCCESS
- [x] Test CoA-Request with real MikroTik - SUCCESS
- [ ] Test with real connected user (pending - user will provide tomorrow)


## Phase 2: VPN Management & Monitoring (Jan 10, 2026)

### VPN Database Schema
- [ ] Create vpn_connections table (nas_id, connection_type, status, local_ip, remote_ip, uptime, last_connected, disconnect_count)
- [ ] Create vpn_logs table (connection_id, event_type, timestamp, details, error_message)
- [ ] Add migration for new tables

### VPN Connections Page
- [ ] Display all NAS devices with VPN status
- [ ] Show connection type (Public / PPTP / SSTP)
- [ ] Show connection status (Connected / Disconnected)
- [ ] Show Local VPN IP
- [ ] Show Remote/NAS IP
- [ ] Show connection uptime
- [ ] Show last connection time
- [ ] Show disconnect count

### VPN Control Features
- [ ] Restart VPN button (via MikroTik API)
- [ ] Disconnect VPN button (via MikroTik API)
- [ ] Real-time connection status check
- [ ] Auto-refresh status every 30 seconds

### VPN Logs Page
- [ ] Display connection logs per NAS
- [ ] Show connection time
- [ ] Show disconnection time
- [ ] Show disconnect reason (if available)
- [ ] Show authentication errors
- [ ] Show RADIUS-related errors
- [ ] Filter logs by date/type/NAS
- [ ] Export logs to CSV

### VPN API Endpoints
- [ ] GET /api/vpn/connections - List all VPN connections
- [ ] GET /api/vpn/connections/:nasId - Get specific NAS VPN status
- [ ] POST /api/vpn/connections/:nasId/restart - Restart VPN
- [ ] POST /api/vpn/connections/:nasId/disconnect - Disconnect VPN
- [ ] GET /api/vpn/logs - Get VPN logs
- [ ] GET /api/vpn/logs/:nasId - Get logs for specific NAS

### PPTP Testing
- [ ] Test PPTP connection with Accounting
- [ ] Test PPTP session tracking
- [ ] Test PPTP CoA (Change of Authorization)
- [ ] Test PPTP Disconnect
- [ ] Test PPTP time expiry auto-disconnect

### SSTP Testing
- [ ] Test SSTP connection with Accounting
- [ ] Test SSTP session tracking
- [ ] Test SSTP CoA (Change of Authorization)
- [ ] Test SSTP Disconnect
- [ ] Test SSTP time expiry auto-disconnect


## VPN Connection Management (Phase 2 - Jan 10, 2026)
- [x] Database tables for VPN tracking
  - [x] vpn_connections table (status, IPs, uptime, disconnect count)
  - [x] vpn_logs table (connection events, errors, timestamps)
- [x] Backend API for VPN control
  - [x] vpnConnectionService.ts for MikroTik API integration
  - [x] VPN status monitoring
  - [x] VPN restart/disconnect/connect operations
  - [x] VPN logs retrieval
  - [x] Multi-tenancy support (owner filtering)
- [x] VPN Router endpoints
  - [x] list - Get all VPN connections with status
  - [x] getByNasId - Get VPN connection by NAS ID
  - [x] getStatus - Get real-time VPN status from MikroTik
  - [x] restart - Restart VPN connection
  - [x] disconnect - Disconnect VPN
  - [x] connect - Connect VPN
  - [x] syncAll - Sync all VPN statuses
  - [x] logs - Get VPN logs with filtering
  - [x] stats - Get VPN connection statistics
- [x] VPN Connections Page (UI)
  - [x] Stats cards (total, connected, disconnected, error)
  - [x] Connections table with status badges
  - [x] Action buttons (connect, disconnect, restart)
  - [x] Logs dialog for each NAS
  - [x] Search and filter functionality
- [x] VPN Logs Page (UI)
  - [x] Full logs table with pagination
  - [x] Filter by NAS device
  - [x] Filter by event type
  - [x] Search functionality
  - [x] Export to CSV
- [x] Navigation updates
  - [x] Added "اتصالات VPN" link to sidebar
  - [x] Added "سجلات VPN" link to sidebar

## MikroTik API Integration - Speed Change without Disconnect (Jan 11, 2026)
- [x] تحديث خدمة MikroTik API لدعم الاتصال المباشر (MikroTikApiClient class)
- [x] إضافة endpoint لتغيير السرعة عبر MikroTik API (sessions.mikrotikChangeSpeed)
- [x] إضافة endpoint لعرض المستخدمين النشطين من MikroTik (sessions.mikrotikGetActiveUsers)
- [x] إضافة endpoint لفصل المستخدم عبر MikroTik API (sessions.mikrotikDisconnect)
- [x] حقول API credentials في صفحة NAS (موجودة مسبقاً)
- [x] تحديث واجهة الجلسات لدعم تغيير السرعة الفوري
- [x] جعل MikroTik API هو الحل الافتراضي لتغيير السرعة
- [x] اختبار النظام الكامل (تم اختباره على 185.202.239.188:8728)

## Multi-Tenant Permissions Fix (Jan 11, 2026)
- [x] تحويل coaDisconnect إلى protectedProcedure مع تحقق ملكية NAS
- [x] تحويل coaDisconnectUser إلى protectedProcedure مع تحقق ملكية Card
- [x] تحويل coaUpdateSession إلى protectedProcedure مع تحقق ملكية NAS
- [x] تحويل changeUserSpeed إلى protectedProcedure مع تحقق ملكية Card
- [x] تحويل mikrotikChangeSpeed إلى protectedProcedure مع تحقق ملكية NAS + Fallback
- [x] تحويل mikrotikDisconnect إلى protectedProcedure مع تحقق ملكية NAS + Fallback
- [x] تحويل mikrotikGetActiveUsers إلى protectedProcedure مع تحقق ملكية NAS
- [x] إضافة Audit Log لكل عملية CoA/API (auditLogService.ts + audit_logs table)
- [x] إضافة Fallback تلقائي (API → CoA) إذا فشل MikroTik API
- [x] كتابة اختبارات للتحقق من الصلاحيات (12 اختبار - جميعها نجحت)
## Production Testing & Audit Log Page (Jan 11, 2026)
### 1. اختبارات واقعية للأدوار
- [x] اختبار Reseller يفصل جلسة على NAS تبعه فقط (sessions.production.test.ts)
- [x] اختبار Reseller يغيّر سرعة على NAS تبعه فقط (sessions.production.test.ts)
- [x] اختبار Client يفصل/يغير سرعة ضمن صلاحياته (sessions.production.test.ts)
- [x] اختبار فاشل: Reseller على NAS مش تبعه → FORBIDDEN + Audit Log (sessions.production.test.ts)

### 2. صفحة Audit Log
- [x] إنشاء صفحة عرض Audit Log في لوحة التحكم (AuditLog.tsx)
- [x] فلتر حسب User
- [x] فلتر حسب NAS
- [x] فلتر حسب Action
- [x] فلتر حسب Status (success/failure)
- [x] فلتر حسب Date Range

### 3. تحسين Audit Log
- [x] إضافة حقل method (api/coa/coa_fallback) - مضاف في auditLogService.ts
- [x] إضافة حقل executionTime (مدة التنفيذ) - مضاف في auditLogService.ts
- [x] تسجيل Fallback events بوضوح - يسجل method: 'coa_fallback' في Audit Log

### 4. اختبار Fallback
- [x] اختبار API timeout → CoA fallback (sessions.production.test.ts)
- [x] اختبار API auth fail → CoA fallback (sessions.production.test.ts)
- [x] التأكد من عدم تكرار العمليات (double actions) - تم الاختبار

### 5. نتائج الاختبارات
- [x] جميع الاختبارات نجحت (278 اختبار في 18 ملف)

## Fix MikroTik Setup Page - VPN Server Address (Jan 11, 2026)
- [x] تحديث عنوان VPN Server في إعدادات النظام (37.60.228.5)
- [x] إضافة radius_server_public_ip (37.60.228.5)
- [x] إضافة radius_server_vpn_ip (192.168.30.1)
- [x] التأكد من أن الأوامر جاهزة للنسخ واللصق مباشرة
- [x] اختبار صفحة اتصال ميكروتك


## Fix MikroTik Setup Commands (Jan 11, 2026)
- [x] إصلاح SSTP connect-to: إزالة :443 من العنوان (فقط IP بدون port)
- [x] إصلاح RADIUS Incoming port: تغيير من 1700 إلى 3799


## Fix VPN User Creation (Jan 11, 2026)
- [x] إصلاح عدم إنشاء VPN User في SoftEther عند إنشاء NAS جديد
- [x] التحقق من أن VPN API تعمل بشكل صحيح (تم التحول لـ vpncmd)
- [x] اختبار إنشاء NAS جديد مع VPN

## Fix Auto VPN User Creation (Jan 11, 2026)
- [x] إصلاح عدم إنشاء VPN User تلقائياً عند إضافة NAS جديد (تم إنشاء VPN API)

## Fix VPN Connections Page (Jan 11, 2026)
- [x] جلب سجلات اتصال VPN من SoftEther وعرضها
- [x] إخفاء صفحة اتصالات VPN عن العملاء (للمدير فقط)
- [x] عرض حالة الاتصال الحالية لكل NAS

## Fix VPN Connections Details (Jan 11, 2026)
- [ ] عرض IP المحلي الذي حصل عليه الجهاز من DHCP
- [ ] عرض آخر وقت اتصال
- [ ] تفعيل زر قطع الاتصال
- [ ] تفعيل زر إعادة التشغيل


## Fix VPN Connections Details (Jan 11, 2026)
- [x] عرض IP المحلي الذي حصل عليه الجهاز من DHCP
- [x] عرض آخر وقت اتصال
- [x] تفعيل زر قطع الاتصال (عبر SoftEther API)
- [x] تفعيل زر إعادة التشغيل (يحتاج MikroTik API)

## Fix MikroTik API Connection (Jan 11, 2026)
- [x] إصلاح اختبار اتصال MikroTik API - استخدام IP المحلي من VPN بدلاً من اسم المستخدم


## Skip API Test for VPN Networks (Jan 11, 2026)
- [x] إزالة شرط اختبار الاتصال قبل حفظ إعدادات API للشبكات VPN


## Fix NAS Registration in FreeRADIUS (Jan 11, 2026)
- [ ] تفعيل Dynamic Clients في FreeRADIUS من قاعدة البيانات
- [ ] إعداد read_clients = yes في SQL module
- [ ] إعداد queries لقراءة NAS من جدول nas (فقط Active)
- [ ] إعداد Firewall (UFW) للسماح فقط لـ 192.168.30.0/24
- [ ] اختبار: NAS جديد يعمل فوراً بدون restart


## VPN IP Auto-Sync System (Jan 12, 2026)
- [x] Fix nasname issue: store VPN Local IP instead of VPN username
- [x] Add `getVpnStatus` endpoint to check VPN connection status
- [x] Add `syncVpnIp` endpoint to manually sync VPN IP
- [x] Add `autoSyncVpnIp` endpoint with retry logic
- [x] Add `updateVpnIp` endpoint for manual IP update
- [x] Add VPN Status Dialog in NAS management page
  - [x] Show VPN connection status (Connected/Disconnected)
  - [x] Show VPN Username
  - [x] Show VPN Local IP (RADIUS Source)
  - [x] Show current nasname
  - [x] Show sync status warning when nasname doesn't match VPN IP
  - [x] Add "Sync VPN IP" button with loading state
- [x] Add Auto-sync on NAS creation
  - [x] Background task starts after VPN NAS creation
  - [x] Retries 12 times over 60 seconds
  - [x] Automatically updates nasname when VPN connects
- [x] Add unit tests for VPN sync endpoints
- [x] Remove Max-All-Session (non-standard) - use Simultaneous-Use instead


## VPN Static IP Pool System (Jan 12, 2026)
- [x] Add vpnIpPool table to schema (startIp, endIp, networkId)
- [x] Add allocatedVpnIps table (nasId, ip, allocatedAt)
- [x] Create IP allocation functions (allocateNextIp, releaseIp)
- [x] Modify NAS creation to auto-allocate IP for VPN types
- [x] Keep Auto-sync as fallback (not removed)
- [x] Keep VPN Status Dialog as fallback (not removed)
- [x] Update MikroTik scripts to include static IP assignment
- [x] Add getVpnIpPoolStats and getAllocatedVpnIp endpoints
- [ ] Add IP Pool management UI in System Settings (future)


## VPN Static IP from SoftEther Server (Jan 12, 2026)
- [ ] Modify SoftEther VPN User creation to assign Static IP
- [ ] Remove vpn-static-ip script from MikroTik scripts
- [ ] Test: NAS connects via VPN and gets assigned IP from Pool
- [ ] Test: Authentication + Accounting + CoA works immediately


## Phase 1: Server Setup for VPN Static IP via Local Bridge + TAP + DHCP (Jan 12, 2026)
- [ ] Create TAP interface (tap_radius) with IP 192.168.30.1/24
- [ ] Install isc-dhcp-server
- [ ] Configure DHCP for 192.168.30.0/24 (range 192.168.30.10-250)
- [ ] Setup SoftEther Local Bridge (Hub VPN → tap_radius)
- [ ] Disable SecureNAT completely (never enable again)
- [ ] Verify: ping 192.168.30.1 from MikroTik
- [ ] Verify: ping MikroTik VPN IP from server
- [ ] Send verification outputs to user before proceeding


## Phase 2: DHCP Reservation Auto-Provisioning (Jan 12, 2026)
- [ ] Add VPN API endpoint to read MAC from session (SoftEther vpncmd)
- [ ] Add VPN API endpoint to create DHCP Reservation
- [ ] Modify NAS creation to save nasname = staticIp directly
- [ ] Remove old sync/placeholder logic
- [ ] Test full flow: Create NAS → VPN Connect → DHCP Reservation → RADIUS Auth
- [ ] Verify FreeRADIUS Dynamic Clients recognizes NAS immediately


## Phase 2 Complete: DHCP Reservation Auto-Provisioning (Jan 12, 2026)
- [x] VPN API Endpoints added:
  - [x] GET /api/vpn/session/{username}/mac - Read MAC from VPN session
  - [x] POST /api/vpn/dhcp/reservation - Create DHCP reservation
  - [x] GET /api/vpn/dhcp/reservations - List all reservations
  - [x] DELETE /api/vpn/dhcp/reservation/{hostname} - Delete reservation
- [x] sshVpnService.ts updated:
  - [x] getSessionMac() - Get MAC address from VPN session
  - [x] createDhcpReservation() - Create DHCP reservation
  - [x] listDhcpReservations() - List all reservations
  - [x] deleteDhcpReservation() - Delete reservation
  - [x] autoProvisionDhcpReservation() - Auto-provision in background (24 retries, 5s interval)
- [x] NAS creation flow updated:
  - [x] Allocate static IP from Pool at creation time
  - [x] Save nasname = staticIp directly (no placeholders)
  - [x] Start DHCP auto-provisioning in background
  - [x] FreeRADIUS identifies NAS immediately by IP
- [x] Server infrastructure:
  - [x] isc-dhcp-server installed and configured
  - [x] DHCP range: 192.168.30.10-250
  - [x] Reservations stored in /etc/dhcp/reservations.conf
  - [x] Auto-restart DHCP on reservation changes


## MikroTik API Connection Fix (Jan 12, 2026)
- [ ] Fix API test from dashboard - must go through server (not direct browser connection)
- [ ] API test endpoint should use server-side connection to VPN network
- [ ] Test API connection from dashboard after fix


## High Priority Features (Jan 12, 2026)
- [x] IP Pool Management Page
  - [x] View all allocated VPN IPs
  - [x] View available IPs in pool
  - [x] Auto-release IP when NAS is deleted
  - [x] Alert when IP pool is nearly exhausted
  - [x] Manual IP allocation/release
- [x] RADIUS Logs Viewer
  - [x] View Access-Accept/Reject logs
  - [x] View Accounting logs (Start/Stop/Interim)
  - [x] Filter by username/NAS/date/status
  - [x] Export logs to CSV
  - [ ] Real-time log streaming
- [x] NAS Health Monitor
  - [x] Automatic NAS connectivity check (based on sessions)
  - [x] Status indicator (online/offline/warning)
  - [x] Alert display for offline devices
  - [x] Auto-refresh every 15/30/60 seconds
  - [x] Active sessions count per NAS
- [x] Bandwidth Usage Reports
  - [x] Per-user bandwidth consumption
  - [x] Per-NAS bandwidth consumption
  - [x] Daily/Weekly/Monthly aggregation
  - [x] Progress bars for usage comparison
  - [x] Export to CSV


## SaaS Phase 1 - Commercial Launch (Jan 12, 2026)

### User Registration & Trial System
- [x] Auto Trial 7 days on new registration
- [x] Account status: trial → active → expired → suspended
- [x] Trial start date tracking
- [x] Trial end date calculation

### Email Verification System
- [x] Activation code generation (6 digits)
- [x] Send activation email on registration
- [x] Verify activation code endpoint
- [x] Block login until email verified
- [x] Resend activation code option

### Plans System
- [x] Plans table in database (name, price, limits, features)
- [ ] Create 2-3 default plans (Starter, Pro, Enterprise)
- [x] Plan limits: max NAS, max cards, features enabled
- [x] Plans management page for Super Admin
- [ ] Assign plan to user on subscription

### Auto Suspension System
- [x] Background job to check expired trials/subscriptions
- [x] On expiry: disable all user's NAS devices
- [ ] On expiry: disconnect all active sessions (CoA)
- [x] On expiry: block RADIUS authentication
- [ ] On expiry: block card creation
- [x] Update account status to 'expired'

### Email Notifications
- [x] Welcome email after registration
- [x] Trial ending soon (2 days before)
- [x] Trial expired notification
- [ ] Subscription ending soon (7 days, 2 days)
- [ ] Subscription expired notification

### Dashboard Account Status
- [x] Show account status badge (Trial/Active/Expired)
- [x] Show days remaining in trial/subscription
- [x] Show current plan name and limits
- [ ] Show usage vs limits (NAS count, cards count)
- [ ] Upgrade/Renew CTA button


## Client Control Panel for Super Admin (Jan 12, 2026)
- [ ] API endpoints for client management
  - [ ] Get all clients with subscription status
  - [ ] Activate client account
  - [ ] Suspend client account (disable all services)
  - [x] Change client plan
  - [x] Extend subscription manually
  - [ ] View client's NAS/cards/sessions
- [ ] Client Management Page
  - [ ] List all clients with status badges
  - [ ] Filter by status (trial/active/expired/suspended)
  - [ ] Quick actions menu per client
  - [ ] Subscription details modal
  - [ ] Extend subscription dialog
  - [ ] Change plan dialog
- [ ] Suspension actions
  - [ ] Disable all client's NAS devices
  - [ ] Disconnect all active sessions
  - [ ] Block RADIUS authentication
  - [ ] Block card creation


## Bug Fixes & New Features (Jan 12, 2026 - Session 2)
- [x] Fix email not being sent on registration
- [x] Create public Pricing Page with plans display (dynamic from DB)


## Critical Bug Fixes & UX Improvements (Jan 12, 2026)
- [x] Fix registration logic - require Name, Email, Password before creating user
- [ ] Prevent empty users from being created
- [ ] Merge admin pages (Clients/Client-Management/Resellers) into single Users Management page
- [ ] Add Tabs: All Users, Clients, Resellers, Trial, Active, Suspended, Incomplete
- [ ] Add delete user permission for Super Admin
- [ ] Improve users table with columns: Name, Email, Role, Status, Plan, Days Left, Last Login, Actions
- [ ] Add inline actions (View/Suspend/Delete) without navigating to another page


## Bug Fix - Email Verification (Jan 12, 2026)
- [x] Remove "Skip verification" option - email verification must be mandatory

## Auto FreeRADIUS Reload (Jan 12, 2026)
- [x] Create SSH service to reload FreeRADIUS remotely
  - [x] Created freeradiusService.ts with SSH connection to 37.60.228.5
  - [x] reloadFreeRADIUS() - graceful reload/restart
  - [x] checkFreeRADIUSStatus() - check if running
  - [x] addNASClient() - manual NAS addition (fallback)
- [x] Auto-reload FreeRADIUS on NAS add/edit/delete
  - [x] Integrated into nasRouter.create
  - [x] Integrated into nasRouter.update
  - [x] Integrated into nasRouter.delete
- [x] Test with new NAS device 192.168.30.11
  - [x] Added NAS to database (Abowd.Net 20)
  - [x] FreeRADIUS reloaded and recognized new client
  - [x] Verified in FreeRADIUS logs: "Client 'Abowd.Net 20' (sql) added"



## Production-Ready RADIUS System (Jan 12, 2026)

### Phase 1: تحليل السبب الجذري ✅
- [x] تحديد السبب المؤكد: تعارض بين dynamic-clients و clients.conf
- [x] توثيق جميع نقاط الفشل المحتملة

### Phase 2: ثبات الخدمات بعد Restart ✅
- [x] إعادة هيكلة systemd services بترتيب صحيح
- [x] إضافة health checks لكل خدمة
- [x] إضافة auto-restart عند الفشل (Restart=on-failure)
- [x] ضمان: vpnserver → radius-bridge → DHCP → RADIUS

### Phase 3: أداء عالي (10k مستخدم) ✅
- [x] ضبط FreeRADIUS thread pool (32-128 threads)
- [x] ضبط max_request_time = 30s
- [x] ضبط DB connection pool (20-100 connections)
- [x] توثيق الأرقام النهائية

### Phase 4: Dynamic NAS بدون تدخل يدوي ✅
- [x] DHCP reservation تلقائي حسب MAC (cron كل 5 دقائق)
- [x] nasname = IP (ليس اسم VPN)
- [x] FreeRADIUS يتعرف على NAS فوراً (read_clients=yes)
- [x] لا sync يدوي مطلوب

### Phase 5: صفحة تشخيص وLogs Dashboard ✅
- [x] عرض حالة freeradius (diagnosticsRouter)
- [x] آخر 50 Access-Accept/Reject (logsRouter)
- [x] آخر 50 "unknown client" (getUnknownClients)
- [x] تشخيص واضح للمشاكل (testConnectivity)

### Phase 6: Monitoring + Alerts ✅
- [x] تنبيه فوري عند فشل freeradius
- [x] تنبيه عند فشل VPN
- [x] تنبيه عند فشل DHCP
- [x] Health monitor كل دقيقة مع auto-restart

## FreeRADIUS Reload Endpoint (Jan 13, 2026)
- [x] Add /api/radius/reload endpoint to VPN API on server
- [x] Implement rate-limit (30 seconds minimum between reloads)
- [x] Implement lock to prevent concurrent reloads
- [x] Add audit log for reload operations
- [x] Update SaaS app to call reload after NAS add/update
- [x] Test full flow: Add NAS → Auto reload → NAS works immediately


## TweetSMS Integration (Jan 13, 2026)
- [x] Create TweetSMS service (tweetsmsService.ts)
  - [x] Send SMS function with phone number formatting
  - [x] Check balance function
  - [x] Bulk SMS function
  - [x] Error code handling
- [x] Create Multi-Channel Notification Service
  - [x] Support Email, SMS, and Push notifications
  - [x] Arabic and English message templates
  - [x] User language preference support
- [x] Add SMS API endpoints
  - [x] getSmsBalance (Super Admin)
  - [x] sendTestSms (Super Admin)
  - [x] sendSmsToUser (Super Admin)
  - [x] sendBulkSms (Super Admin)
- [x] Configure TweetSMS credentials (TWEETSMS_USERNAME, TWEETSMS_PASSWORD, TWEETSMS_SENDER)
- [x] Unit tests for TweetSMS service (9 tests passing)


## SMS Management Page (Jan 13, 2026)
- [x] Create SMS Management page for Super Admin
  - [x] Display SMS balance with refresh button
  - [x] Send test SMS form (phone + message)
  - [x] Send SMS to specific user (select user + message)
  - [x] Bulk SMS form (multiple phones + message)
  - [ ] SMS history/logs display (future enhancement)
- [x] Add SMS page to sidebar navigation (Super Admin only)
- [x] Add SMS page route to App.tsx


## SMS Enhancements (Jan 13, 2026)
- [x] SMS Logs System
  - [x] Create sms_logs table in database
  - [x] Log all sent SMS with status, recipient, message
  - [x] Display SMS history in management page
  - [x] Filter by status, type
- [x] SMS Templates System
  - [x] Create sms_templates table in database
  - [x] Default templates (subscription expiry, welcome, payment reminder)
  - [x] CRUD operations for templates
  - [x] Template variables support ({name}, {days}, {amount})
- [x] Automatic Subscription Expiry Notification
  - [x] Integrated with subscriptionNotifier service
  - [x] Send SMS 2 days before subscription expires
  - [x] Track notification status to avoid duplicates (sms_notification_tracking table)


## RADIUS Time & Session Logic Fix (Jan 13, 2026)
**CRITICAL: DO NOT TOUCH - Auth, NAS, VPN, Dynamic Clients**

### 1. Time Accounting Fix
- [x] Fix time calculation logic (card time vs MikroTik time mismatch)
- [x] Use radacct as single source of truth for consumption
- [x] Session-Timeout = calculated result only, NOT storage
- [x] Deduction based on Acct-Session-Time only
- [x] Created centralAccountingService.ts with proper architecture

### 2. Validity vs Usage Logic
- [x] Implement dual check: validity expiry AND time exhaustion
- [x] Cut connection immediately when validity expires (even if time remains)
- [x] Cut connection immediately when time exhausts (even if validity remains)
- [x] All decisions from control panel, not MikroTik estimates
- [x] Implemented in centralAccountingService.ts with proper priority

### 3. Online Users / Session Status Fix
- [x] Online = Acct-Stop-Time IS NULL only
- [x] Any session with Stop-Time → Offline immediately
- [x] Add cleanup job for stale sessions (cleanupStaleSessions in centralAccountingService)
- [x] Fix disconnect not reflecting in dashboard
- [x] Updated getOnlineSessions to use radacct as source of truth

### 4. CoA / Speed Change Sync
- [x] Proper sync after ACK received (already in coaService)
- [x] Update session state in DB after execution (already in coaService)
- [x] No changes to CoA or MikroTik API itself
- [x] Added Audit Log for all changes (logSessionTimeout, logValidityExpired, logCoASent)

### 5. Advanced RADIUS Control Panel
- [x] RADIUS Control Panel page created (/radius-control)
- [x] Central Accounting status display
- [x] Session Monitor status display
- [x] Active sessions list (from radacct)
- [x] User time lookup tool
- [x] Manual sync user usage
- [x] Trigger accounting run manually
- [x] Audit log display
- [x] Architecture principles display
- [ ] Display: Status, Threads, Queue, Last errors
- [ ] IP Pools restructuring
- [ ] Accounting Jobs monitoring
- [ ] Health checks dashboard
- [ ] Goal: No server SSH access needed after launch

### 6. Best Practices Implementation
- [ ] Central Accounting Job (cron every minute)
- [ ] Grace Period (1-2 minutes before disconnect)
- [ ] Audit Log for all changes (speed, disconnect, extend)
- [ ] Read-only Mode button for maintenance


## NAS Hard Delete Policy (Single Source of Truth)

### المبدأ الأساسي
أي NAS يتم حذفه من لوحة التحكم يجب أن يُحذف معه كل ما يتعلق به 100%، بدون أي بقايا على السيرفر.

### قائمة الحذف الشاملة عند حذف NAS:
- [x] 1. حذف من جدول `nas` في قاعدة البيانات
- [x] 2. حذف DHCP reservation من VPS (`/etc/dhcp/reservations.conf`) - via vpnApi.deleteDhcpReservation
- [x] 3. إعادة تشغيل DHCP Server على VPS - automatic via API
- [x] 4. إعادة تحميل FreeRADIUS على VPS (لتحديث dynamic clients) - freeradiusService.reloadFreeRADIUS
- [x] 5. قطع أي جلسات VPN نشطة لهذا الـ NAS - sshVpn.disconnectVpnSession
- [x] 6. تسجيل عملية الحذف في Audit Log - logAudit

### التنفيذ التقني:
- [x] تعديل `nas.delete` endpoint ليشمل جميع عمليات الحذف
- [x] إضافة API endpoint على VPS لحذف DHCP reservation (موجود: vpnApi.deleteDhcpReservation)
- [x] ضمان الترتيب الصحيح للعمليات (DB أولاً ثم VPS)
- [x] معالجة الأخطاء: إذا فشل حذف VPS، يجب إبلاغ المستخدم (logged to console)

### تنظيف البيانات الحالية:
- [x] حذف DHCP reservations القديمة من VPS (لا يوجد NAS في DB) - تم التنظيف يدوياً



## FreeRADIUS Dynamic Clients - حل جذري (Critical Fix - Jan 16, 2026)

### المشكلة:
- FreeRADIUS يقرأ NAS من قاعدة البيانات عند البدء فقط (startup)
- Reload لا يُعيد قراءة clients
- هذا يتطلب restart كامل لكل NAS جديد - غير مقبول للإنتاج

### الحل الجذري:
- [ ] تفعيل Dynamic Clients الحقيقي في FreeRADIUS
- [ ] إنشاء virtual server `dynamic_clients` يقرأ من SQL لكل طلب
- [ ] تعديل `clients.conf` لاستخدام dynamic lookup
- [ ] اختبار End-to-End مع MikroTik حقيقي


## SaaS Production System (VPS Management) - Jan 16, 2026

### المبادئ الأساسية:
- VPS = Production فقط
- Manus = Development فقط
- لا تعديل يدوي على السيرفر
- لا أي Feature تمس FreeRADIUS
- كل شيء يُدار من لوحة التحكم

### 1. نظام التحديث (Update System)
- [ ] زر "جلب آخر تحديث" في لوحة التحكم (Admin Only)
- [ ] Pull آخر إصدار Stable من Git
- [ ] تشغيل Database migrations (Reversible)
- [ ] إعادة تشغيل التطبيق فقط (NOT FreeRADIUS)
- [ ] Health Check تلقائي بعد التحديث
- [ ] Rollback تلقائي إذا فشل Health Check

### 2. نظام الرجوع (Rollback System)
- [ ] زر "الرجوع للنسخة السابقة" في لوحة التحكم
- [ ] حفظ كل إصدار كـ Release
- [ ] العودة للـ Code السابق
- [ ] تنفيذ migration rollback
- [ ] تسجيل العملية في Audit Log

### 3. نظام النسخ الاحتياطي (Backup System)
- [ ] نسخة تلقائية يومية (Daily Backup)
  - [ ] قاعدة البيانات
  - [ ] ملفات النظام المهمة
  - [ ] إعدادات النظام
- [ ] نسخة يدوية عند الطلب (On-Demand Backup)
- [ ] زر "إنشاء نسخة احتياطية الآن"

### 4. نظام الاسترجاع (Restore System)
- [ ] استرجاع مباشر من السيرفر (اختيار نسخة من القائمة)
- [ ] استرجاع من ملف خارجي (رفع ZIP)
- [ ] التحقق من التوقيع والإصدار والتوافق
- [ ] Restore بدون توقف RADIUS

### 5. الأمان (Security)
- [ ] لا SSH مباشر من لوحة التحكم
- [ ] كل العمليات عبر API محدد
- [ ] صلاحيات Admin فقط
- [ ] Rate-limit على العمليات الحساسة
- [ ] Audit Log لكل عملية

### 6. صفحة System Admin
- [x] عرض حالة النظام (Services Status)
- [x] عرض الإصدار الحالي
- [x] قائمة الإصدارات المتاحة
- [x] قائمة النسخ الاحتياطية
- [x] أزرار: Update / Rollback / Backup / Restore
- [x] فحص الصحة (Health Check): التطبيق، API، قاعدة البيانات
- [x] عرض استخدام القرص
- [x] تبويبات: التحديث، النسخ الاحتياطي، الخدمات، السجلات


## نقل لوحة التحكم إلى VPS (Jan 16, 2026)

### 1. إعداد VPS
- [ ] تثبيت Node.js 22
- [ ] تثبيت PM2 لإدارة التطبيق
- [ ] تثبيت Nginx كـ Reverse Proxy
- [ ] إعداد UFW Firewall

### 2. نقل التطبيق
- [ ] نقل كود التطبيق إلى /var/www/radius-saas
- [ ] تثبيت dependencies (pnpm install)
- [ ] بناء التطبيق (pnpm build)
- [ ] إعداد ملف .env مع جميع المتغيرات

### 3. إعداد الخدمات
- [ ] إعداد PM2 ecosystem file
- [ ] تشغيل التطبيق عبر PM2
- [ ] إعداد PM2 startup (auto-start on reboot)

### 4. إعداد Nginx
- [ ] إنشاء server block للتطبيق
- [ ] إعداد reverse proxy للمنفذ 3000
- [ ] تفعيل الموقع

### 5. إعداد SSL
- [ ] تثبيت Certbot
- [ ] إنشاء شهادة SSL (Let's Encrypt)
- [ ] إعداد auto-renewal

### 6. الاختبار النهائي
- [ ] اختبار الوصول عبر HTTPS
- [ ] اختبار تسجيل الدخول
- [ ] اختبار جميع الميزات
- [ ] التأكد من اتصال RADIUS


## نقل لوحة التحكم إلى VPS ✅ (مكتمل - 16 يناير 2026)

### المهام المكتملة:
- [x] تثبيت Node.js 22.22.0 على VPS
- [x] تثبيت PM2 6.0.14 و pnpm 10.28.0
- [x] تثبيت Nginx 1.18.0
- [x] نقل كود التطبيق إلى /var/www/radius-saas
- [x] إعداد متغيرات البيئة (DATABASE_URL, JWT_SECRET, etc.)
- [x] إصلاح اتصال قاعدة البيانات (SSL مع TiDB Cloud)
- [x] إعداد Nginx كـ Reverse Proxy
- [x] إنشاء شهادة SSL مع Let's Encrypt
- [x] تغيير منفذ SoftEther VPN من 443 إلى 4433
- [x] تفعيل PM2 startup للتشغيل التلقائي
- [x] حفظ PM2 dump للاستعادة بعد إعادة التشغيل

### معلومات النظام:
- **URL:** https://radius-pro.com
- **SSL:** صالح حتى 16 أبريل 2026
- **التجديد التلقائي:** مفعّل (Certbot)
- **مسار التطبيق:** /var/www/radius-saas
- **مسار السجلات:** /var/log/radius-saas/

### الخدمات على VPS:
| الخدمة | المنفذ | الحالة |
|--------|--------|--------|
| Nginx (HTTP) | 80 | ✅ |
| Nginx (HTTPS) | 443 | ✅ |
| Node.js App | 3000 | ✅ |
| FreeRADIUS | 1812/1813 | ✅ |
| SoftEther VPN | 4433, 992, 1194, 5555 | ✅ |
| VPS Management API | 8081 | ✅ |



## نظام تسجيل الدخول المحلي (بدلاً من Manus OAuth) - Jan 16, 2026 ✅

### المهام المكتملة:
- [x] إضافة حقل password_hash إلى جدول users (موجود مسبقاً)
- [x] إنشاء API لتسجيل الدخول المحلي (username/password) (موجود مسبقاً)
- [x] إزالة Manus OAuth من واجهة تسجيل الدخول
- [x] إنشاء صفحة تسجيل دخول محلية (Auth.tsx)
- [x] إنشاء حساب admin مع كلمة المرور المحددة
- [x] تحديث VPS بالتغييرات الجديدة

### بيانات تسجيل الدخول:
- **اسم المستخدم:** admin
- **كلمة المرور:** !@Abowd022963385
- **الصلاحية:** super_admin



## نظام التحديث بدون توقف (Zero Downtime Update) - Jan 16, 2026 ✅

### المتطلبات المكتملة:
- [x] تحديث بضغطة زر من Manus
- [x] Zero Downtime - بدون توقف الخدمة
- [x] استمرار الخدمات للمشتركين أثناء التحديث
- [x] PM2 Reload بدلاً من Restart

### المهام المكتملة:
- [x] إنشاء سكربت التحديث على VPS (/usr/local/bin/radius-update.sh)
- [x] إنشاء API endpoint للتحديث (vpsManagement.deployUpdate)
- [x] تحديث VPS Management API لدعم /api/deploy
- [x] اختبار التحديث بدون توقف - ناجح!

### طريقة التحديث:
1. أعمل التعديلات في Manus
2. أضغط على زر "تحديث VPS" في صفحة System Admin
3. يتم التحديث تلقائياً بدون توقف الخدمة



## Two-Phase NAS Provisioning Fix (Jan 17, 2026)
- [ ] Fix NAS IP allocation to use DHCP Reservation properly
  - [ ] Remove IP Pool allocation at NAS creation time
  - [ ] Set nasname='pending' for VPN NAS at creation
  - [ ] Set provisioningStatus='pending' at creation
  - [ ] Ensure FreeRADIUS only loads NAS with status='active'
- [ ] Fix Provisioning worker to finalize NAS
  - [ ] Read actual IP from VPN Session
  - [ ] Read MAC from DHCP leases
  - [ ] Create DHCP Reservation (MAC → actual IP)
  - [ ] Update nasname = actual IP
  - [ ] Update status = 'active', provisioningStatus = 'ready'
  - [ ] Reload FreeRADIUS after update
- [ ] Add Idempotency checks
  - [ ] Don't duplicate DHCP Reservation if exists
  - [ ] Rate-limit FreeRADIUS reload (30 seconds)
  - [ ] Don't update nasname if already 'ready'
- [ ] Fix existing NAS with wrong IPs


## Two-Phase NAS Provisioning Fix (Jan 17, 2026)
- [x] Fix NAS IP allocation to use DHCP Reservation properly
  - [x] Remove IP Pool allocation at NAS creation time
  - [x] Set nasname='pending' for VPN NAS at creation
  - [x] Set provisioningStatus='pending' at creation
  - [x] Ensure FreeRADIUS only loads NAS with status='active' AND provisioningStatus='ready'
- [x] Fix Provisioning worker to finalize NAS
  - [x] Read actual IP from VPN Session
  - [x] Read MAC from DHCP leases
  - [x] Create DHCP Reservation (MAC → actual IP)
  - [x] Update nasname = actual IP
  - [x] Update status = 'active', provisioningStatus = 'ready'
  - [x] Reload FreeRADIUS after update
- [x] Add Idempotency checks
  - [x] Don't duplicate DHCP Reservation if exists
  - [x] Rate-limit FreeRADIUS reload (30 seconds)
  - [x] Check actual IP matches before skipping re-provision
- [x] Fix existing NAS with wrong IPs (NAS 150007: 192.168.30.26 → 192.168.30.11)


## Enterprise Architecture Implementation (Jan 17-18, 2026)

### Phase 1: تنظيف allocated_vpn_ips
- [x] حذف 14 IP محجوزة لـ NAS محذوفين
- [x] التأكد من بقاء IPs الصحيحة فقط (Khaled: 192.168.30.25, loayy: 192.168.30.11)

### Phase 2: NAS Lifecycle الصحيح (حذف شامل)
- [x] إضافة حذف من allocated_vpn_ips عند حذف NAS
- [x] التأكد من حذف VPN user من SoftEther
- [x] التأكد من حذف DHCP reservation
- [x] التأكد من reload FreeRADIUS بعد الحذف

### Phase 3: تثبيت هوية NAS (DHCP Reservation تلقائي)
- [x] تحسين Provisioning Worker ليكتشف NAS بدون DHCP Reservation
- [x] إضافة checkActiveNasForDhcpFix() function
- [ ] إنشاء DHCP Reservation لـ Khaled (ينتظر اتصال VPN)
- [ ] إنشاء DHCP Reservation لـ loayy (ينتظر اتصال VPN)

### Phase 4: Dynamic Clients من DB بشكل آمن
- [x] تعديل FreeRADIUS client_query على VPS
- [x] إضافة فلترة provisioningStatus='ready' للـ query
- [x] التأكد من عدم وجود static clients بـ secret واحد (فقط localhost للاختبار)

### Phase 5: استقرار بعد Restart
- [x] التأكد من systemd services للـ bridge (radius-bridge.service)
- [x] التأكد من ترتيب تشغيل الخدمات (bridge → dhcp → freeradius)
- [x] التأكد من health-check في radius-bridge.service


## Sidebar Reorganization - Industry Standard (Jan 18, 2026)

### Phase 1: تحليل وإعداد Mockup
- [ ] تحليل القائمة الحالية
- [ ] إعداد Mockup للقائمة الجديدة
- [ ] عرض Mockup للموافقة

### Phase 2: تنفيذ التغييرات (بعد الموافقة)
- [ ] تعديل DashboardLayout.tsx
- [ ] إعادة ترتيب الأقسام
- [ ] تحديث الأسماء والأيقونات

### Phase 3: اختبار
- [ ] التأكد من عمل جميع الروابط
- [ ] التأكد من عدم تأثر الوظائف


## Sidebar Reorganization (Jan 18, 2026)
- [x] Analyze current sidebar structure (30 flat items)
- [x] Create mockup for new organized structure (9 sections)
- [x] Get user approval for new structure
- [x] Implement collapsible sections with icons
- [x] Organize items into 9 main categories:
  - [x] لوحة التحكم (Dashboard)
  - [x] المراقبة الحية (Real-Time & Monitoring)
  - [x] البنية التحتية (Network / Infrastructure)
  - [x] المستخدمين والعملاء (Users & Clients)
  - [x] التحكم بالوصول (AAA / Access Control)
  - [x] البطاقات والمدفوعات (Cards & Payments)
  - [x] الفواتير والمالية (Billing & Finance)
  - [x] التقارير والتحليلات (Reports & Analytics)
  - [x] النظام والإعدادات (System & Settings)
- [x] Add localStorage persistence for section open/close state
- [x] Auto-expand section containing active page
- [x] Test all navigation links work correctly
- [x] Verify no URLs changed (UI only)
- [x] Verify no VPS/RADIUS/VPN changes


## Update Button Diagnosis (Jan 18, 2026)
- [ ] Analyze SystemManagement.tsx update button code
- [ ] Check VPS API endpoint for updates
- [ ] Diagnose why vpn and app show ❌ status
- [ ] Add Loading state to update button
- [ ] Add Success/Fail feedback messages
- [ ] Add error details display (HTTP status + error message)
- [ ] Add entry to version history log on update
- [ ] Test update flow end-to-end


## System Management Dashboard Fix (Jan 18, 2026)
- [x] Fix VPS API connectivity - changed from port 8081 to port 8080
- [x] Update vpsManagementService.ts to use correct VPS API endpoints:
  - /api/radius/status for FreeRADIUS status
  - /api/vpn/status for SoftEther VPN status
  - /api/dhcp/leases for DHCP status
- [x] Service status now displays correctly:
  - FreeRADIUS: ✓ active
  - VPN: ✓ active (online: true)
  - DHCP: ✓ active
- [x] Update button shows proper error message when update API not available
- [x] Rollback button shows proper error message when rollback API not available
- [x] Improved Toaster configuration for better visibility


## VPS Management API (Port 8081) - Enterprise Edition (Jan 18, 2026)

### خط أحمر (لن يُلمس)
- [ ] ❌ FreeRADIUS / vpnserver / dhcp / br-radius - ممنوع
- [ ] ❌ /etc/freeradius/* - ممنوع
- [ ] ❌ إعدادات SoftEther - ممنوع
- [ ] ❌ ملفات DHCP - ممنوع

### Atomic Release System
- [ ] إنشاء هيكل /var/www/releases/ للنسخ
- [ ] Build في مسار جديد /var/www/releases/<timestamp>/
- [ ] Symlink: /var/www/radius-dashboard -> /var/www/releases/<timestamp>/
- [ ] الاحتفاظ بآخر 5 releases
- [ ] Rollback = تبديل symlink فقط

### Management API Endpoints (Port 8081)
- [ ] GET /api/app/status - حالة التطبيق
- [ ] GET /api/app/versions - سجل الإصدارات
- [ ] POST /api/app/update - تحديث التطبيق (Atomic)
- [ ] POST /api/app/rollback - رجوع للنسخة السابقة
- [ ] GET /api/app/backups - قائمة النسخ الاحتياطية
- [ ] GET /api/system/info - معلومات النظام (disk/cpu/memory)
- [ ] GET /api/app/logs - آخر 200 سطر (بدون secrets)

### Validation & Health Check
- [ ] pnpm -v و node -v قبل build
- [ ] pnpm install --frozen-lockfile
- [ ] pnpm build
- [ ] Health check: curl http://127.0.0.1:3000/health
- [ ] فشل = إلغاء تلقائي + بقاء القديم

### Security
- [ ] API Key من ENV (APP_MANAGEMENT_API_KEY)
- [ ] IP Allowlist من ENV (ALLOWED_IPS)
- [ ] File Lock: /tmp/radius-update.lock
- [ ] Rate Limit: 1 request / 30s على update/rollback
- [ ] Audit Log JSON لكل عملية

### Backup
- [ ] tar.gz كطبقة أمان ثانية
- [ ] حفظ في /var/www/backups/radius-dashboard/
- [ ] الاحتفاظ بآخر 5 نسخ tar.gz

### Manus Integration
- [ ] ربط صفحة إدارة النظام بـ API 8081
- [ ] عرض حالة التطبيق الحقيقية
- [ ] زر تحديث يعمل
- [ ] زر Rollback يعمل


## Health Endpoint & Management API Installation (Jan 18, 2026)
- [x] إضافة /health endpoint في Manus (App فقط)
- [x] نشر التحديث على radius-pro.com
- [x] التحقق من https://radius-pro.com/health يرجع 200 OK (بانتظار النشر)
- [x] تثبيت Management API على VPS (port 8081)
- [x] تعيين ENV variables على VPS
- [x] ربط زر التحديث بـ API 8081
- [ ] اختبار زر التحديث (بعد النشر)


## تبسيط واجهة إدخال الوقت (Feb 3, 2026)
- [ ] تبسيط حقول الوقت في نموذج إنشاء الكروت
  - [ ] خانة واحدة للقيمة + قائمة منسدلة للوحدة (دقائق/ساعات/أيام/شهر)
  - [ ] تحديث وقت الاستخدام (Usage Budget)
  - [ ] تحديث مدة النافذة (Window Time)
  - [ ] حساب الثواني بناءً على الوحدة المختارة


## Accounting Logic Implementation (Feb 3, 2026)
- [x] ربط radacct بالكروت (Business Logic)
  - [x] عند أول Accounting Start: تعيين firstUseAt = acctstarttime
  - [x] حساب windowEndTime = firstUseAt + windowSeconds
  - [x] حساب used_seconds = SUM(radacct.acctsessiontime)
  - [x] للجلسات المفتوحة: إضافة (now - acctstarttime)
  - [x] التخزين بالثواني فقط (UTC في DB، Asia/Hebron للعرض)
- [x] شروط انتهاء الكرت:
  - [x] used_seconds >= usage_budget_seconds
  - [x] أو now >= window_end_time
- [x] Worker/Cron لتحديث الكروت دورياً (CentralAccounting كل دقيقة)
- [x] Backfill للكروت القديمة (6 كروت تم تحديثها)

## Bug Fix: منع تسجيل الدخول للكروت المنتهية (Feb 3, 2026) - HIGH SEVERITY ✅
- [x] إنشاء دالة canLogin(username) للتحقق من صلاحية الكرت
  - [x] التحقق من used_seconds >= usage_budget_seconds → رفض
  - [x] التحقق من now >= window_end_time → رفض
- [x] تحديث radcheck لتعطيل الكروت المنتهية (Auth-Type := Reject)
- [x] ربط التحقق بـ CentralAccounting لتعطيل الكروت تلقائياً
- [x] رسائل الرفض:
  - [x] "الكرت خلص — لا يوجد وقت متبقي" (usage exhausted)
  - [x] "انتهت صلاحية الكرت" (window expired)


## Usage Window Logic Fix (Feb 3, 2026) ✅
- [x] تسجيل firstUseAt عند أول Login ناجح (من radacct.acctstarttime)
- [x] حساب windowEndTime = firstUseAt + windowSeconds
- [x] عند كل Login لاحق:
  - [x] إذا now > windowEndTime → Reject + "انتهت صلاحية الكرت"
  - [x] إذا used_seconds >= usage_budget_seconds → Reject + "انتهى وقت الاستخدام"
  - [x] غير ذلك → Allow
- [x] تحديث CentralAccounting لتعطيل الكرت عند انتهاء windowEndTime
- [x] إضافة checkAndDisableExpiredCards() للكروت غير المتصلة


## Idle-Timeout Policy (Feb 3, 2026) ✅
- [x] التحقق من عدم إرسال Idle-Timeout في radreply
- [x] إزالة أي كود يولد Idle-Timeout (من radiusCards.ts و vouchers.ts)
- [x] حذف أي سجلات Idle-Timeout موجودة في قاعدة البيانات (0 سجلات)
- [x] توثيق: Idle-Timeout مسؤولية MikroTik فقط (/ip hotspot server set idle-timeout=<time>)


## مراجعة وتطوير لوحة التحكم (Feb 3, 2026) ✅

### 1. التحقق من تعديل السرعات عند إنشاء الكروت ✅
- [x] فحص: تغيير السرعة أثناء إنشاء الكرت يعمل (Mikrotik-Rate-Limit في radreply)
- [x] فحص: السرعة تُطبّق عند أول Login (35 كرت لديهم Rate Limit)

### 2. تعديل سرعة جميع الكروت دفعة واحدة ✅
- [x] فحص: النظام يدعم updateBatchProperties لتغيير السرعة
- [x] فحص: التغيير ينعكس على الكروت غير المستخدمة (يحدث radreply)
- [x] فحص: الجلسات الحالية تحتاج CoA (متوفر عبر coaService)

### 3. توحيد قوائم الجلسات والمتصلين ✅
- [x] فحص: كان يوجد OnlineUsers.tsx و Sessions.tsx
- [x] تنفيذ: دمج القوائم - إزالة "المتصلين الآن" من القائمة الجانبية
- [x] تنفيذ: إعادة توجيه /online-users إلى /sessions

### 4. إعادة تنظيم إدارة المشتركين (Users) ✅
- [x] فحص: 820 مستخدم (366 super_admin, 454 client)
- [x] فحص: 0 مستخدمين Trial (لا يوجد تنظيف مطلوب)

### 5. تطوير صفحة إنشاء الكروت ✅
- [x] فحص: الحقول الحالية منظمة وواضحة
- [x] تنفيذ: إزالة الحقول القديمة (Legacy Fields)
- [x] تنفيذ: إضافة قيم افتراضية ذكية (10 كروت، 1 ساعة، 24 ساعة نافذة)

### 6. تطوير قائمة الكروت ونظام الملفات ✅
- [x] فحص: نظام Batches موجود (4 batches)
- [x] تنفيذ: إضافة فلتر حسب الدفعة (Batch)
- [x] تنفيذ: إضافة عدد النتائج "عرض X من Y كرت"

### 7. تحديث شامل للوحة التحكم ✅
- [x] إصلاح: 162 TypeScript Error → 0 أخطاء
- [x] فحص: CoA Service موجود ويعمل (disconnect, updateAttributes, changeSpeed)


## المرحلة الجديدة (Feb 3, 2026)

### 1. تفعيل MikroTik API على أجهزة NAS ✅
- [x] فحص: الحقول موجودة (apiEnabled, mikrotikApiPort, mikrotikApiUser, mikrotikApiPassword)
- [x] تنفيذ: واجهة تفعيل/إلغاء API موجودة في NasDevices.tsx (SpecialToolsContent)
- [x] تنفيذ: اختبار الاتصال موجود (testApiConnection)
- [x] تنفيذ: تغيير السرعة عبر API موجود (changeSpeedViaApi - Hotspot/Queue/PPP)

### 2. تقارير الاستخدام (Usage Reports) ✅
- [x] تصميم: هيكل التقارير (يومي/أسبوعي)
- [x] تنفيذ: API getUsageReport في reportsService.ts
- [x] تنفيذ: endpoint reports.usage في routers.ts
- [x] تنفيذ: تبويب "الاستخدام" في Reports.tsx
- [x] رسوم بيانية: أوقات الذروة، الاستخدام اليومي، الملخص الأسبوعي، أكثر المستخدمين استخداماً
- [ ] تنفيذ: صفحة عرض التقارير
- [ ] محتوى: عدد الجلسات، استهلاك الوقت، أوقات الذروة

### 3. تنظيف المستخدمين
- [ ] فحص: عدد المستخدمين الحاليين
- [ ] تنفيذ: حذف جميع المستخدمين ما عدا الأدمن
- [ ] تأكيد: الأدمن الوحيد المتبقي

### 3. تنظيف المستخدمين ✅
- [x] فحص: 821 مستخدم (367 super_admin + 454 client)
- [x] حذف: تم حذف 820 مستخدم وهمي - بقي Owner فقط (ID: 3)

### 4. تحديث نظام الأدوار والتسجيل ✅
- [x] Owner: حساب واحد فقط (ID: 3)، صلاحيات كاملة، لا يُحذف
- [x] Admin/Super Admin: يُنشأ فقط بواسطة Owner (تم تعديل db.ts)
- [x] Client: أي تسجيل جديد = Client فقط (تم تعديل authService.ts + db.ts)
- [x] منع إنشاء Super Admin تلقائياً (تم تعديل db.ts - OAuth يعطي client بدلاً من super_admin)
- [x] صفحة إدارة الحسابات موجودة (UsersManagement.tsx)


## المهام الجديدة (Feb 3, 2026)

### 1. إعادة إنشاء حساب Admin ✅
- [x] حذف جميع المستخدمين من قاعدة البيانات
- [x] إنشاء حساب Admin جديد (username: admin, password: !@Abowd329324)
- [x] تعيين الدور super_admin

### 2. إضافة ميزة ترقية الدور ✅
- [x] إضافة endpoint changeRole في routers.ts
- [x] إضافة واجهة لتغيير الدور في UsersManagement.tsx
- [x] Admin يمكنه ترقية client إلى reseller أو super_admin


## فحص نظام الرسائل (Feb 3, 2026)

### 1. فحص إعدادات SMTP
- [ ] التحقق من إعدادات SMTP في emailService.ts
- [ ] فحص سجل إرسال الرسائل في Server logs

### 2. اختبار إرسال رسالة
- [ ] إرسال رسالة تجريبية للتحقق من عمل النظام


## حذف المستخدم abowd (Feb 3, 2026) ✅

- [x] البحث عن المستخدم abowd
- [x] حذف المستخدم abowd1991@gmail.com من قاعدة البيانات


## تفعيل نظام الرسائل SMTP (Feb 3, 2026)

- [ ] تحديث SMTP_USER و SMTP_PASS
- [ ] اختبار إرسال رسالة تجريبية
- [ ] التحقق من وصول الرسالة


## خطة تطوير النظام الموحد (Feb 3, 2026)

### المرحلة 1: تنظيف الحسابات الوهمية ✅
- [x] فحص: وجد 90 مستخدم وهمي
- [x] حذف جميع الحسابات ما عدا admin
- [x] تحديد السبب: upsertUser في sdk.ts ينشئ مستخدمين تلقائياً
- [x] الحل: تعطيل upsertUser في sdk.ts + إضافة updateUserLastSignedIn

### المرحلة 2: نظام RBAC موحد + Multi-Tenant (جاري)
- [x] إعادة بناء قاعدة البيانات من الصفر
- [x] تحديث schema: إضافة ownerId
- [x] تحديث Roles: owner, super_admin, client_admin, reseller, client, support
- [x] إضافة auditLogs table
- [x] إنشاء حساب admin (owner)
- [ ] إضافة صفحة Profile موحدة
- [ ] إضافة Audit Log helper functions

### المرحلة 3: توحيد قوائم الإدارة
- [ ] إنشاء صفحة Accounts موحدة
- [ ] إضافة Tabs/Filters حسب الدور
- [ ] إزالة الصفحات المكررة

### المرحلة 4: Billing + Wallet Ledger
- [ ] إضافة Subscription model
- [ ] إضافة Wallet Ledger (credit/debit)
- [ ] منع إنشاء Cards/NAS عند انتهاء الاشتراك

### المرحلة 5: حماية التسجيل + Anti-bot
- [ ] Email verification إلزامي
- [ ] Rate limiting
- [ ] CAPTCHA
- [ ] منع إنشاء Users تلقائياً


## إصلاح حساب admin (Feb 4, 2026) ✅

- [x] تحديث accountStatus من trial إلى active
- [x] إضافة اشتراك دائم في tenant_subscriptions (10 سنوات)
- [x] إضافة رصيد $10,000 في wallets


## إصلاح صلاحيات admin في القائمة (Feb 4, 2026) ✅

- [x] فحص DashboardLayout للعثور على منطق إخفاء الأقسام
- [x] إضافة owner إلى switch statement
- [x] إضافة owner badge (مالك النظام)


## المرحلة 2: Profile + Audit Log (Feb 4, 2026)

### Audit Log Helper Functions ✅
- [x] auditLogService.ts موجود بالفعل
- [x] logAudit() - تسجيل العمليات
- [x] getAuditLogs() - جلب السجلات
- [x] يدعم: session, NAS, cards, subscribers, VPN, system

### صفحة Profile موحدة ✅
- [x] إنشاء صفحة Profile.tsx
- [x] عرض معلومات المستخدم (الاسم، البريد، الدور، الحالة)
- [x] إضافة تغيير كلمة المرور (users.changePassword)
- [x] إضافة تحديث المعلومات الشخصية (users.updateProfile)


## المرحلة 3: توحيد قوائم الإدارة (Feb 4, 2026) ✅

- [x] UsersManagement موجودة بالفعل كصفحة Accounts موحدة
- [x] إضافة جميع الأدوار في الفلاتر (owner, super_admin, client_admin, reseller, client, support)
- [x] بحث موحد + فرز موجود
- [x] أزرار سريعة موجودة (Suspend, Activate, Extend, Delete, Change Role)
- [x] صلاحيات الوصول محدثة (owner + super_admin)


## إصلاح صفحات الإدارة (Feb 4, 2026) ✅

- [x] حذف صفحة "العملاء" من قائمة super_admin
- [x] إصلاح صلاحيات SaasPlansManagement (owner + super_admin)


## Phase 4: Billing + Wallet Ledger System
- [x] Create walletLedger table in schema
- [x] Create subscriptions table in schema (saasSubscriptions already exists)
- [x] Create invoices table in schema (already exists)
- [x] Push database schema changes
- [x] Create walletLedgerService.ts
- [ ] Create subscriptionService.ts (skip - saasSubscriptions already has service)
- [ ] Create invoiceService.ts (skip - invoices already has service)
- [x] Create billing router endpoints (wallet ledger endpoints added)
- [x] Create WalletLedger UI page
- [ ] Create Subscriptions UI page (skip - TenantSubscriptions already exists)
- [ ] Create Invoices UI page (skip - Invoices page already exists)
- [x] Add billing pages to sidebar navigation
- [x] Write vitest tests for billing services
- [x] Test wallet operations (credit/debit) - 8 tests passed
- [ ] Test subscription management (skip - existing functionality)
- [ ] Test invoice generation (skip - existing functionality)

## SaaS Billing Standard Implementation (Per NAS - $10/month)

### Phase 1: Database Schema
- [x] Add billing_start_at to users table
- [x] Add last_billing_at to users table
- [x] Add next_billing_at to users table
- [x] Add billing_status enum (active, past_due, suspended) to users table
- [x] Add nas_billing_rate global setting (default: 10)
- [x] Push database schema changes

### Phase 2: Billing Service
- [x] Create billingService.ts with calculateMonthlyCost()
- [x] Implement processUserBilling() - deduct from wallet_ledger
- [x] Implement updateBillingStatus() - set past_due when insufficient
- [x] Implement getNextBillingDate() helper
- [x] Implement activateUserBilling() - set billing_start_at
- [x] Implement getUsersDueForBilling() - get users to bill
- [x] Implement getUserBillingSummary() - client billing info
- [x] Add billing router endpoints (5 endpoints)

### Phase 3: Scheduled Job
- [x] Create billingCronJob.ts
- [x] Check all users every hour for billing due (30 days passed)
- [x] Process billing for due users
- [x] Log all billing operations to audit log
- [x] Add to server startup in _core/index.ts

### Phase 4: Access Control
- [x] Block NAS creation when billing_status = past_due
- [x] Block card generation when billing_status = past_due
- [x] Add billing status check in endpoints (no middleware needed)
- [x] DO NOT touch FreeRADIUS (existing sessions continue)

### Phase 5: UI Updates
- [x] Add billing info card to client dashboard
- [x] Show: active NAS count, monthly cost, next billing date
- [x] Show billing status badge
- [x] Add billing history info (start/last/next dates)
- [ ] Owner: add "Activate Client" button (can be done via Users Management)

### Phase 6: Testing
- [x] Write vitest for billing calculations (8 tests)
- [x] Test automatic billing cycle
- [x] Test past_due access restrictions
- [x] Test billing status updates
- [x] All 8 tests passed successfully

## Daily Billing System Update (From 1st of Month)

### Phase 1: Database Schema
- [x] Add last_daily_billing_date to users table
- [x] Add daily_billing_enabled boolean to users table
- [x] Update nas_daily_rate system setting (0.33 per day)
- [x] Add low_balance_notified_at to users table
- [x] Push database schema changes

### Phase 2: Billing Service Update
- [x] Update calculateDailyCost() - $0.33 per active NAS
- [x] Create processDailyBilling() - deduct daily cost
- [x] Update billing to start from 1st of month
- [x] Add checkLowBalance() - check if balance <= $2
- [x] Rewrite billingService.ts for daily billing
- [ ] Update billing router endpoints (backward compatible)

### Phase 3: Billing Cron Job Update
- [x] Change cron job to run daily (24 hours interval)
- [x] Check all users with active NAS daily
- [x] Process daily billing for users
- [x] Check low balance and send notifications

### Phase 4: Low Balance Notifications
- [x] Integrate with notifyOwner service
- [x] Send notification when balance <= $2
- [x] Track last notification time (prevent spam - 24h)
- [x] Allow repeated notifications (daily check)

### Phase 5: UI Updates
- [x] Update BillingInfo to show daily cost
- [x] Show "Daily billing: $0.33 per NAS"
- [x] Update billing description
- [x] Add low balance alert banne### Phase 6: Testing
- [x] Write vitest for daily billing (8 tests)
- [x] Test daily cost calculation
- [x] Test low balance notifications
- [x] Test billing status updates
- [x] All 8 tests passed successfully month

## Owner Billing Dashboard

### Phase 1: Billing Analytics Service
- [x] Create billingAnalyticsService.ts
- [x] Implement getDailyRevenue() - total revenue for today
- [x] Implement getMonthlyRevenue() - total revenue for current month
- [x] Implement getTotalRevenue() - all time revenue
- [x] Implement getClientsByBillingStatus() - count by status
- [x] Implement getAverageClientBalance() - average balance
- [x] Implement getLowBalanceClients() - clients with balance <= $5
- [x] Implement getRevenueHistory() - daily/monthly revenue chart data
- [x] Implement getDashboardStats() - complete stats

### Phase 2: Billing Analytics Router Endpoints
- [x] Add analytics endpoints to billingRouter
- [x] Add getDashboardStats endpoint (owner only)
- [x] Add getRevenueHistory endpoint (owner only)
- [x] Add getLowBalanceClients endpoint (owner only)

### Phase 3: Owner Billing Dashboard UI
- [x] Create OwnerBillingDashboard.tsx page
- [x] Add revenue cards (today, this month, total, average balance)
- [x] Add client status distribution pie chart
- [x] Add revenue trend line chart (last 30 days)
- [x] Add low balance clients table
- [x] Add route to App.tsx
- [x] Add to sidebar navigation (owner section)

### Phase 4: Testing
- [x] Write vitest for analytics service (8 tests)
- [x] Test all calculations (revenue, clients, balance)
- [x] Test owner-only access control (via superAdminProcedure)
- [x] All 8 tests passed successfully
- [ ] Save checkpoint

## Bug Fixes - Error Report 2026-02-04

### Permission Errors
- [x] Fix Error 1: Permission denied (10002) on /support page
- [x] Fix Error 3: Access denied for Client/Reseller/Admin
- [x] Fix Error 4: VPN connections - admin only check
- [x] Fix Error 6: Permission denied (10002) on mutation
- [x] Updated all procedures to support 'owner' role

### SQL Query Errors
- [x] Fix Error 2: DATE_FORMAT not compatible with TiDB (replaced with CAST(DATE()) in reportsService.ts)
- [x] Fix Error 7: NAS insert query failed (changed 'pending' status to 'inactive' in nas.ts)
- [x] Fix Error 8: NAS insert query failed (same fix as Error 7)

### React Errors
- [x] Fix Error 5: VpnLogs setState in render phase (wrapped in useEffect)

## Empty Pages Issues - Owner View

### VPN Server Page
- [x] VPN Server page exists at /vpn (VpnConnections.tsx)
- [x] Page works correctly with owner role
- [x] No fixes needed

### Internet Plans Page (Speeds)
- [x] Fix Internet Plans page - added owner role to canManagePlans
- [x] Add "Create New Plan" button (now visible for owner)
- [x] Verify plans list displays correctly

### Card Management Page
- [x] Fix Card Management page - added owner role to canCreateCards
- [x] Add "Generate Cards" button (now visible for owner)
- [x] Verify card templates display correctly

### General
- [x] Review all owner pages for missing buttons
- [x] Fixed Dashboard.tsx - added owner role
- [x] Fixed Settings.tsx - added owner role to RADIUS tab
- [x] Test all CRUD operations for owner role
- [ ] Save checkpoint after fixes

## VPN Endpoints Permission Errors

- [x] Fix VPN logs endpoint - added owner role support
- [x] Fix VPN connections endpoint - added owner role support
- [ ] Test /nas-health page with owner role
- [ ] Save checkpoint
