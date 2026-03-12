const fs = require('fs');
const path = require('path');

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "INC-2026-05441";
const CASE_NAME = "Ryan Carter — Contractor IT Onboarding";

// --- Helpers ---
const readJson  = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const delay     = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const updateProcessLog = (processId, logEntry, keyDetailsUpdate = {}) => {
    const processFile = path.join(PUBLIC_DATA_DIR, `process_${processId}.json`);
    let data = { logs: [], keyDetails: {}, sidebarArtifacts: [] };
    if (fs.existsSync(processFile)) data = readJson(processFile);

    if (logEntry) {
        const existingIdx = logEntry.id ? data.logs.findIndex(l => l.id === logEntry.id) : -1;
        if (existingIdx !== -1) {
            data.logs[existingIdx] = { ...data.logs[existingIdx], ...logEntry };
        } else {
            data.logs.push(logEntry);
        }
    }

    if (keyDetailsUpdate && Object.keys(keyDetailsUpdate).length > 0) {
        data.keyDetails = { ...data.keyDetails, ...keyDetailsUpdate };
    }
    writeJson(processFile, data);
};

const updateProcessListStatus = async (processId, status, currentStatus) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${apiUrl}/api/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: processId, status, currentStatus })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(processId));
            if (idx !== -1) {
                processes[idx].status = status;
                processes[idx].currentStatus = currentStatus;
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
            }
        } catch (err) { }
    }
};

const waitForSignal = async (signalId) => {
    console.log(`Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');

    // clear stale signal on start
    for (let i = 0; i < 15; i++) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (!content) continue;
                const signals = JSON.parse(content);
                if (signals[signalId]) {
                    delete signals[signalId];
                    const tmp = signalFile + '.' + Math.random().toString(36).slice(2) + '.tmp';
                    fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
                    fs.renameSync(tmp, signalFile);
                }
                break;
            }
        } catch (e) { await delay(Math.floor(Math.random() * 200) + 100); }
    }

    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`Signal ${signalId} received!`);
                        delete signals[signalId];
                        const tmp = signalFile + '.' + Math.random().toString(36).slice(2) + '.tmp';
                        fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
                        fs.renameSync(tmp, signalFile);
                        return true;
                    }
                }
            }
        } catch (e) { }
        await delay(1000);
    }
};

const waitForEmail = async () => {
    console.log("Waiting for user to send email...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        await fetch(`${API_URL}/email-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sent: false })
        });
    } catch (e) {}
    while (true) {
        try {
            const response = await fetch(`${API_URL}/email-status`);
            if (response.ok) {
                const { sent } = await response.json();
                if (sent) { console.log("Email sent!"); return true; }
            }
        } catch (e) { }
        await delay(2000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            "subject": "Ryan Carter, IT Infrastructure Contractor",
            "request": "System access provisioning \u2014 contractor onboarding",
            "ticketId": "INC-2026-05441",
            "priority": "P2 \u2014 High",
            "contractType": "Fixed Term \u2014 3 Months",
            "engagementScope": "Cloud Migration \u2014 AWS to Azure",
            "submittedBy": "David Langley, Head of IT Infrastructure",
            "assignedTo": "IT Service Desk"
},
        sidebarArtifacts: []
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Receiving ticket from ServiceNow...",
            title_s: "Ticket received and classified as contractor onboarding request",
            reasoning: [
                "Ticket INC-2026-05441 ingested from ServiceNow via API",
                "Request submitted by David Langley on behalf of contractor Ryan Carter",
                "Engagement scope identified as Cloud Migration \u2014 AWS to Azure",
                "Contract type identified as fixed term \u2014 3 months",
                "Requester flagged as external contractor \u2014 contractor onboarding policy applies"
],
            artifacts: [
                { id: "tbl-ticket-001", type: "table", label: "Ticket Details", data: {"Ticket ID": "INC-2026-05441", "Contractor": "Ryan Carter", "Engagement": "Cloud Migration \u2014 AWS to Azure", "Contract Type": "Fixed Term \u2014 3 Months", "Start Date": "2026-03-17", "Submitted By": "David Langley \u2014 Head of IT Infrastructure", "Priority": "P2 \u2014 High"} }
            ],
            delay_ms: 2000
        },
        {
            id: "step-2",
            title_p: "Identifying systems required for contractor role...",
            title_s: "3 systems identified — 1 collaboration tool and 2 infrastructure access systems",
            reasoning: [
                "Queried internal entitlement matrix using contractor role and engagement scope",
                "Cloud Migration engagement mapped to a defined system access profile",
                "Outlook identified as collaboration tool \u2014 low sensitivity",
                "VPN and CyberArk identified as infrastructure access \u2014 high sensitivity",
                "Background check verification required before proceeding to provisioning"
],
            artifacts: [
                { id: "tbl-sys-001", type: "table", label: "Required Systems", data: {"Collaboration Tools": "Outlook", "Infrastructure Access": "VPN, CyberArk", "Total Systems": "3", "Background Check Required": "Yes \u2014 Contractor Policy CT-SEC-3.1"} }
            ],
            delay_ms: 3000
        },
        {
            id: "step-3",
            title_p: "Retrieving background check status for Ryan Carter...",
            title_s: "Background check incomplete — criminal record check and reference verification outstanding",
            reasoning: [
                "Queried HR background check system using Ryan Carter's contractor ID",
                "Identity verification confirmed \u2014 passed",
                "Credit check confirmed \u2014 passed",
                "Criminal record check \u2014 not yet submitted to screening provider",
                "Reference verification \u2014 one of two required references not yet returned",
                "Background check status returned as incomplete \u2014 two items outstanding",
                "Contractor policy CT-SEC-3.1 requires full background check clearance for infrastructure access"
],
            artifacts: [
                { id: "tbl-bgc-001", type: "table", label: "Background Check Status", data: {"Contractor": "Ryan Carter", "Identity Verification": "Complete", "Credit Check": "Complete", "Criminal Record Check": "Incomplete \u2014 Pending Submission", "Reference Verification": "Incomplete \u2014 1 of 2 References Returned", "Overall Status": "Incomplete", "Policy Reference": "CT-SEC-3.1"} }
            ],
            delay_ms: 4000
        },
        {
            id: "step-4",
            title_p: "Determining which systems can be provisioned under current clearance status...",
            title_s: "Outlook cleared for provisioning — VPN and CyberArk blocked pending full clearance",
            reasoning: [
                "Cross-referenced background check status against system sensitivity tiers",
                "Outlook does not require full background check clearance per policy CT-SEC-3.1",
                "VPN and CyberArk require full clearance before provisioning",
                "Criminal record check and reference verification outstanding \u2014 infrastructure access remains blocked",
                "Partial provisioning possible for Outlook only"
],
            artifacts: [
                { id: "tbl-assess-001", type: "table", label: "Provisioning Assessment", data: {"Systems Cleared for Provisioning": "Outlook", "Systems Blocked": "VPN, CyberArk", "Reason for Block": "Criminal Record Check and Reference Verification Outstanding", "Policy Reference": "CT-SEC-3.1"} }
            ],
            delay_ms: 3000
        },
        {
            id: "step-5",
            title_p: "Flagging provisioning decision for review...",
            title_s: "Partial provisioning possible — awaiting decision",
            reasoning: [
                "Full background check clearance not yet obtained for Ryan Carter",
                "Outlook carries no sensitive data access and can be provisioned under current clearance",
                "VPN and CyberArk blocked until criminal record check and reference verification are complete",
                "Decision required on whether to proceed with partial provisioning or hold everything"
],
            artifacts: [],
            delay_ms: 2000,
            isHitl: true,
            signalName: "PROVISION_PARTIAL",
            hitlQuestion: "Background check is incomplete. Outlook can be provisioned now. VPN and CyberArk remain blocked. How would you like to proceed?",
            hitlOptions: [
                {
                                "label": "Provision Outlook now, VPN and CyberArk once background check is cleared",
                                "value": "provision_partial",
                                "signal": "PROVISION_PARTIAL"
                },
                {
                                "label": "Hold all provisioning until full background check is complete",
                                "value": "hold_all",
                                "signal": "HOLD_ALL"
                }
]
        },
        {
            id: "step-6",
            title_p: "Evaluating whether this decision should set a precedent...",
            title_s: "Partial provisioning approved — checking whether to update contractor onboarding policy",
            reasoning: [
                "Partial provisioning decision represents a new operational precedent",
                "Standardising this approach would reduce delays for future contractors awaiting clearance",
                "Decision required on whether to codify this into the contractor onboarding policy"
],
            artifacts: [],
            delay_ms: 2000,
            isHitl: true,
            signalName: "UPDATE_POLICY",
            hitlQuestion: "This is the first time partial provisioning has been approved for a contractor pending full background check. Should this become the standard approach for future contractor onboarding cases?",
            hitlOptions: [
                {
                                "label": "Yes \u2014 update knowledge base for all future contractor onboarding cases",
                                "value": "update_kb",
                                "signal": "UPDATE_POLICY"
                },
                {
                                "label": "No \u2014 treat this as a one-time exception only",
                                "value": "one_time",
                                "signal": "NO_UPDATE"
                }
]
        },
        {
            id: "step-7",
            title_p: "Updating knowledge base with new contractor onboarding precedent...",
            title_s: "Knowledge base updated — partial provisioning approved as standard for future contractor onboarding",
            reasoning: [
                "Knowledge base article KB-CT-0042 updated to reflect partial provisioning as standard approach",
                "Policy updated \u2014 Outlook can be provisioned upon identity and credit check clearance",
                "Infrastructure access policy unchanged \u2014 full background check clearance remains mandatory",
                "Update logged and attributed to ticket INC-2026-05441 as the originating case"
],
            artifacts: [
                { id: "tbl-kb-001", type: "table", label: "Knowledge Base Update", data: {"Article": "KB-CT-0042", "Update": "Partial provisioning approved for contractors pending full background check", "Collaboration Tools": "Provisionable upon identity and credit check clearance", "Infrastructure Access": "Full background check clearance required \u2014 unchanged", "Originating Case": "INC-2026-05441"} }
            ],
            delay_ms: 2000
        },
        {
            id: "step-8",
            title_p: "Provisioning Outlook for Ryan Carter...",
            title_s: "Outlook mailbox created and active for Ryan Carter",
            reasoning: [
                "Navigated identity management portal to create Ryan Carter's contractor account",
                "Outlook mailbox created at ryan.carter.ext@meridianbank.com \u2014 contractor domain convention applied",
                "Account confirmed active and accessible"
],
            artifacts: [
                { id: "tbl-prov-001", type: "table", label: "Provisioning Confirmation", data: {"User": "Ryan Carter", "Email": "ryan.carter.ext@meridianbank.com", "Outlook": "Active", "VPN": "Blocked \u2014 Pending Background Check Clearance", "CyberArk": "Blocked \u2014 Pending Background Check Clearance"} }
            ],
            delay_ms: 4000
        },
        {
            id: "step-9",
            title_p: "Drafting RFI to David Langley detailing background check status and provisioning outcome...",
            title_s: "RFI email ready — awaiting send",
            reasoning: [
                "RFI sent to David Langley as the submitting manager",
                "Email details exactly what has been provisioned and what remains blocked",
                "Outstanding background check items clearly itemised so David knows precisely what needs to be resolved",
                "Automatic provisioning trigger noted so David does not need to resubmit a ticket"
],
            artifacts: [
                { id: "email-rfi-001", type: "email_draft", label: "Contractor Onboarding Update — Ryan Carter", data: {"to": "david.langley@meridianbank.com", "from": "itservicedesk@meridianbank.com", "cc": "", "bcc": "", "subject": "Contractor Onboarding Update \u2014 Ryan Carter (INC-2026-05441)", "body": "Hi David,\n\nWe have processed the onboarding request for Ryan Carter (INC-2026-05441) and wanted to update you on the current status.\n\nWhat has been provisioned:\nRyan's Outlook mailbox is now active at ryan.carter.ext@meridianbank.com and is ready for his start date on March 17.\n\nWhat is outstanding:\nRyan's infrastructure access \u2014 VPN and CyberArk \u2014 cannot be provisioned until his background check is fully complete. We have identified two outstanding items:\n\n1. Criminal record check \u2014 not yet submitted to the screening provider. Please ensure this is submitted as a priority.\n2. Reference verification \u2014 one of two required references has not yet been returned. Please follow up with Ryan or his references directly to expedite this.\n\nOnce both items are cleared and the background check is marked as complete, we will automatically provision Ryan's VPN and CyberArk access without requiring a new ticket.\n\nPlease treat this as urgent given Ryan's start date of March 17. If you have any questions please contact the IT Service Desk at itsecuritydesk@meridianbank.com or call extension 4400.\n\nThanks,\nIT Service Desk\nMeridian Bank", "isIncoming": false, "isSent": false} }
            ],
            delay_ms: 2000,
            isEmailHitl: true
        },
        {
            id: "step-10",
            title_p: "Closing ticket in ServiceNow...",
            title_s: "Ticket partially resolved — VPN and CyberArk pending background check clearance",
            reasoning: [
                "Outlook provisioned and confirmed active",
                "VPN and CyberArk blocked pending criminal record check and reference verification",
                "RFI sent to submitting manager with full details of outstanding items",
                "Ticket status updated to Pending \u2014 Background Check Clearance",
                "Automatic trigger configured to resume infrastructure provisioning once background check is marked complete"
],
            artifacts: [
                { id: "tbl-res-001", type: "table", label: "Resolution Summary", data: {"Ticket ID": "INC-2026-05441", "Status": "Partially Resolved \u2014 Pending Background Check Clearance", "Outlook": "Provisioned", "VPN": "Blocked", "CyberArk": "Blocked", "Outstanding Items": "Criminal Record Check, Reference Verification", "Next Action": "Auto-resume on background check clearance", "SLA Status": "Met"} }
            ],
            delay_ms: 2000,
            isFinal: true
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = step.isFinal || i === steps.length - 1;

        // --- processing write ---
        updateProcessLog(PROCESS_ID, {
            id: step.id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: step.title_p,
            status: "processing"
        });
        await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_p);
        await delay(step.delay_ms || 2200);

        // --- decision HITL ---
        if (step.isHitl) {
            const decisionArtifact = {
                id: `decision-${step.id}`,
                type: "decision",
                label: "Manual Review",
                data: {
                    question: step.hitlQuestion || step.title_s,
                    options: step.hitlOptions || []
                }
            };
            const allArtifacts = [...(step.artifacts || []), decisionArtifact];
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: allArtifacts
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", step.title_s);
            await waitForSignal(step.signalName);
            await updateProcessListStatus(PROCESS_ID, "In Progress", `Approved: ${step.title_s}`);
            await delay(1500);

        // --- email HITL ---
        } else if (step.isEmailHitl) {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Draft Review: Email Pending");
            await waitForEmail();
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: "Email sent successfully",
                status: "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Email sent");
            await delay(1500);

        // --- normal step ---
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_s,
                status: isFinal ? "completed" : "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, isFinal ? "Done" : "In Progress", step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
