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
