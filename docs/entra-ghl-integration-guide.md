# Enabling GHL API Access to SRE Microsoft 365

**To:** Maaz Shareef, Director — Sulfur Recovery Engineering
**From:** Varun Shukla, SRE Nexus / Integration Owner
**Date:** August 12, 2026
**Subject:** Registering an Entra application to expose Microsoft 365 data (mail, calendar, SharePoint, contacts) to GoHighLevel

---

## Executive Summary

GoHighLevel (GHL) is being adopted as SRE's CRM foundation. To sync sales activity, proposals, meetings, and email conversations into the CRM without duplicate manual entry, GHL requires programmatic access to SRE's Microsoft 365 tenant. Microsoft's standard mechanism for this is **an application registration in Microsoft Entra** (formerly Azure Active Directory) with **admin-consented API permissions** and a **client secret** provided to GHL.

This memo is the step-by-step guide for creating that registration. Estimated time to complete: **20–30 minutes**, executed once. It requires **Global Administrator** or **Application Administrator** privileges on the SRE tenant.

The scope requested is **full Microsoft 365 sync**: mail, calendar, SharePoint, and contacts.

---

## Prerequisites

| Item | Detail |
|---|---|
| Admin role | Global Administrator or Application Administrator on the SRE Entra tenant |
| Portal | https://entra.microsoft.com |
| Credentials store | Secure secret manager (1Password / Bitwarden / Azure Key Vault) to hand credentials to GHL |
| GHL onboarding contact | Confirm redirect URI and required scopes from GHL's Microsoft integration documentation before starting |

---

## Step-by-Step Guide

### Step 1 — Sign in to the Entra Admin Center

1. Navigate to https://entra.microsoft.com
2. Sign in with an account that has Global Administrator rights on the SRE tenant
3. Verify the correct tenant is selected (top-right avatar → tenant name reads *Sulfur Recovery Engineering* or equivalent)

### Step 2 — Register the Application

1. From the left navigation, expand **Applications**
2. Click **App registrations**
3. Click **+ New registration** at the top of the page
4. Fill out the form:
   - **Name:** `SRE — GoHighLevel Integration`
   - **Supported account types:** *Accounts in this organizational directory only (Single tenant)*
   - **Redirect URI:** Leave blank for now (GHL will provide the exact URI during their setup; typically `https://services.leadconnectorhq.com/oauth/callback` — confirm with GHL)
5. Click **Register**

### Step 3 — Copy the Application Identifiers

On the app's **Overview** page, note and securely store the following two values (these are not secrets, but GHL will need them):

- **Application (client) ID** — a GUID
- **Directory (tenant) ID** — a GUID

Store both in a shared password manager entry titled "GHL Integration — Entra credentials".

### Step 4 — Create a Client Secret

1. Left navigation → **Certificates & secrets**
2. Under the **Client secrets** tab, click **+ New client secret**
3. **Description:** `GHL Integration Secret — created 2026-08-12`
4. **Expires:** `24 months` (Microsoft's default maximum — record a calendar reminder for renewal in 2028)
5. Click **Add**
6. **Immediately copy the value shown in the *Value* column (not the ID).** This is displayed only once. Store in the password manager alongside the Client ID.

> ⚠️ **If you navigate away without copying the secret, it cannot be retrieved.** You must delete it and create a new one.

### Step 5 — Configure API Permissions

1. Left navigation → **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions** (not *Delegated*; GHL operates as a background service without a signed-in user)
5. Search for and add each of the following permissions:

| Permission | Purpose |
|---|---|
| `Mail.Read` | Read email across all mailboxes for CRM activity sync |
| `Mail.Send` | Send emails via shared mailbox or on behalf of sales (optional — omit if GHL only reads) |
| `Contacts.Read` | Read Outlook contacts for CRM deduplication |
| `Calendars.Read` | Read calendar events for meeting logging |
| `Sites.Read.All` | Read SharePoint sites and their metadata |
| `Files.Read.All` | Read files (proposal documents, POs) from SharePoint document libraries |
| `User.Read.All` | Resolve user identities when correlating email/calendar activity |

6. Click **Add permissions**

> **Note on scope reduction:** If your security policy requires it, replace `Sites.Read.All` with `Sites.Selected` and grant per-site access via Microsoft Graph after registration. This is more secure but requires additional configuration.

### Step 6 — Grant Admin Consent

Application permissions are inert until an administrator explicitly consents to them on behalf of the tenant.

1. On the **API permissions** page, click the **Grant admin consent for [SRE tenant]** button at the top of the permissions table
2. Confirm the dialog
3. Verify each permission's **Status** column now shows a green checkmark labeled *Granted for [tenant]*

### Step 7 — (Optional) Restrict Mailbox Scope

By default, application-level Mail permissions apply to every mailbox in the tenant. To restrict GHL to specific mailboxes (e.g., only Sales), use Exchange Online PowerShell to create an ApplicationAccessPolicy:

```powershell
Connect-ExchangeOnline

# Create a mail-enabled security group in Entra containing the mailboxes you
# want GHL to access, then reference its object ID here:
New-ApplicationAccessPolicy `
  -AppId "<APPLICATION_CLIENT_ID_FROM_STEP_3>" `
  -PolicyScopeGroupId "sales-mailboxes@sulfurrecovery.com" `
  -AccessRight RestrictAccess `
  -Description "GHL restricted to Sales mailboxes"
```

Skip this step if GHL is expected to sync every mailbox.

### Step 8 — Provide Credentials to the GHL Integrator

Share the following four values via a secure channel (password manager share, encrypted vault, or 1Password/Bitwarden shared item — **not** plain email or chat):

| Field | Source |
|---|---|
| Tenant ID | Step 3 |
| Client ID | Step 3 |
| Client Secret | Step 4 |
| Permission scopes granted | Step 5 (copy the final list) |

The OAuth token endpoint GHL will call is:

```
https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token
```

### Step 9 — Verify the Integration

1. In GHL admin, configure the Microsoft integration with the four values above
2. Trigger a test sync from GHL (e.g., pull one mailbox or one SharePoint site)
3. Confirm the expected data appears inside GHL
4. In Entra, navigate to **Applications** → **Enterprise applications** → *SRE — GoHighLevel Integration* → **Sign-in logs** to confirm successful token issuance
5. If the sign-in log shows failures, share the correlation ID with the GHL support team

---

## Security & Governance Notes

- **Secret rotation:** The client secret expires in 24 months. Add a calendar reminder for August 2028 to rotate before expiry.
- **Audit review:** Review Entra sign-in logs for this application at least quarterly. Anomalous IP addresses, sudden request-volume spikes, or failed-auth bursts should trigger investigation.
- **Permission review:** Annually confirm each granted permission is still needed. Remove any that GHL has stopped using.
- **Conditional Access:** If GHL publishes fixed egress IP ranges, apply a Conditional Access policy restricting this application's sign-ins to those ranges.
- **Least privilege:** If GHL's actual usage is narrower than the requested scope after a few months of operation, downgrade permissions (e.g., drop `Mail.Send` if unused).

---

## Rollback

To revoke GHL's access immediately:

- **Fastest:** Entra → App registrations → *SRE — GoHighLevel Integration* → **Certificates & secrets** → delete the active client secret. This kills all outstanding tokens once they expire (max 1 hour).
- **Complete:** Entra → App registrations → *SRE — GoHighLevel Integration* → **Delete** the registration. This is destructive — permissions and all secrets are removed permanently.
- **Soft-disable:** Entra → Enterprise applications → *SRE — GoHighLevel Integration* → **Properties** → toggle **Enabled for users to sign-in** to `No`. Reversible.

---

## Contacts

| Role | Person | Email |
|---|---|---|
| Executive sponsor | Maaz Shareef | maaz@sulfurrecovery.com |
| Integration owner | Varun Shukla | varun@sulfurrecovery.com |
| GHL support | (per GHL onboarding) | — |

---

*End of memo. Please confirm completion of Steps 1–8 before the GHL integrator begins their configuration.*
