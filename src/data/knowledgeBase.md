# IT Service Management — Meridian Bank Knowledge Base

## Overview

Meridian Bank's IT Service Management (ITSM) platform handles all internal IT requests, incidents, and changes across the organization. This knowledge base covers the core workflows, policies, and procedures that Pace uses to process service requests autonomously.

## Service Categories

### Access Management
- **Software Access Requests**: Provisioning access to licensed software (Adobe, Salesforce, etc.)
- **VPN Access**: Corporate VPN provisioning via Cisco AnyConnect
- **System Access**: ERP, CRM, and banking platform access
- **Privileged Access**: Elevated permissions for IT and finance teams

### Incident Management
- **P1 – Critical**: System outages affecting all users. SLA: 1 hour resolution.
- **P2 – High**: Major functionality impaired. SLA: 4 hours resolution.
- **P3 – Medium**: Partial functionality impaired. SLA: 8 hours resolution.
- **P4 – Low**: Minor issues, requests. SLA: 2 business days.

### Hardware & Equipment
- **Laptop Procurement**: New hire and replacement laptops (Dell, MacBook)
- **Peripherals**: Monitors, keyboards, headsets
- **Mobile Devices**: Corporate phones and tablets

### Password & Authentication
- **Password Resets**: Self-service via portal or IT desk
- **MFA Setup**: Duo Security enrollment and troubleshooting
- **Account Lockouts**: Active Directory account unlock

## Key Systems

| System | Purpose | Owner |
|--------|---------|-------|
| ServiceNow | ITSM ticketing platform | IT Operations |
| Active Directory | User identity and access | IT Security |
| Okta | SSO and MFA | IT Security |
| Cisco AnyConnect | VPN client | Network Team |
| Jira | Engineering project tracking | Engineering |
| Confluence | Internal documentation | All teams |

## Approval Thresholds

- **Auto-approve**: Standard access requests matching role entitlement matrix
- **Manager approval**: Requests exceeding role standard or flagged accounts
- **Director approval**: Privileged access, bulk provisioning (10+ licenses)
- **CISO approval**: Security exceptions, external access grants

## SLA Policy

All service requests are subject to the following SLAs:
- Acknowledgement: 15 minutes (business hours), 1 hour (off-hours)
- Resolution targets vary by priority (see Incident Management above)
- Escalation triggers automatically at 80% of SLA window

## Entitlement Matrix

### Engineering
- Standard: GitHub, Jira, Confluence, Slack, VPN Full Access
- Auto-approve threshold: All standard tools

### Finance
- Standard: Oracle ERP, Excel, PowerBI, VPN Split-Tunnel
- Requires manager approval: Oracle privileged roles

### Operations
- Standard: ServiceNow, Slack, Outlook, VPN Split-Tunnel
- Auto-approve threshold: All standard tools

### Risk & Compliance
- Standard: GRC platform, Archer, Confluence, VPN Full Access
- Requires director approval: External audit access

## Common Procedures

### Password Reset
1. User submits ticket via ServiceNow portal
2. Identity verified via employee ID + manager confirmation
3. Temporary password issued via secure channel
4. User prompted to reset on next login
5. MFA re-enrollment required if device lost

### New Hire Onboarding
1. HR submits onboarding request 5 business days before start
2. AD account created with role-based group memberships
3. Software provisioned per role entitlement matrix
4. Laptop imaged and shipped/ready at desk
5. Welcome email sent with credentials and setup guide

### Offboarding
1. HR submits offboarding request on last day
2. AD account disabled immediately on departure
3. All access revoked within 24 hours
4. Equipment return tracked via asset management
5. Data archived per retention policy (7 years for finance roles)
