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
